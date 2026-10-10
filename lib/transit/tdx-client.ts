// 伺服器端專用：只能從 app/api/** 的 route handler 匯入，絕不能進到 "use client" 檔案，
// 否則 TDX_CLIENT_SECRET 會被打包進前端 bundle。

import { getDb } from "../mongodb";

const TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const BASE_URL = "https://tdx.transportdata.tw/api/basic";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const clientId = process.env.TDX_CLIENT_ID;
  const clientSecret = process.env.TDX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("缺少 TDX_CLIENT_ID / TDX_CLIENT_SECRET 環境變數，請先設定 .env.local");
  }

  // 使用 URLSearchParams 正確編碼 application/x-www-form-urlencoded。
  // 不要直接用字串拼接，否則 clientId / clientSecret 裡若包含
  // &, =, +, %, ?, #, 空白等特殊字元，TDX 可能會把 body 解析錯誤而回 HTTP 400。
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    // 不只保留 HTTP status，也把 TDX 實際回傳內容帶回來。
    // 這樣遇到 400 時才能知道是 invalid_client、invalid_request
    // 或其他 OAuth 錯誤，而不是只看到「HTTP 400」。
    const errorBody = await res.text();
    throw new Error(`TDX 換取 token 失敗：HTTP ${res.status}${errorBody ? ` ${errorBody}` : ""}`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token) {
    throw new Error("TDX 換取 token 失敗：回應中沒有 access_token");
  }

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;

  // 提前 60 秒視為過期，避免卡在剛好過期那一刻送出請求。
  // 最低保留 1 秒，避免 expires_in 太短時產生負數。
  const cacheLifetimeMs = Math.max(1_000, (expiresIn - 60) * 1000);

  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + cacheLifetimeMs,
  };

  return cachedToken.token;
}

// 這個帳號的額度是每分鐘 5 次（實測 RateLimit-Limit header 看到的）。一次查詢台鐵時刻表
// 就會打 2～3 個不同 path（時刻表＋即時誤點＋票價），很容易一兩次互動就把額度用完，
// 所以快取時間設得跟額度重置週期（60 秒）一樣長，同一個 path 一分鐘內最多只會打一次。
// 不快取失敗結果，失敗就從快取移除，下次重新打。
const CACHE_TTL_MS = 60_000;

// 這一層是 process 記憶體內的第一層快取，同一個還熱著的 function instance 連續打同個
// path 時完全不用等 Mongo 往返；它也靠「存 promise 不是存值」順便處理同一 instance 內
// 多個併發請求打同個 path 的情況，大家等同一個 promise，不會真的各自打一次 TDX。
const memCache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

interface TdxCacheDoc {
  _id: string; // path
  data: unknown;
  expiresAt: Date;
}

/**
 * 呼叫 TDX 資料 API，path 例如 "/v3/Rail/TRA/StationLiveBoard/Station/1100"（不含 /api/basic 前綴）。
 * ttlMs 可覆寫快取時間——車站清單這種幾乎不會變的靜態資料可以傳更長的 TTL，不要每次都占掉額度。
 *
 * 快取分兩層：process 記憶體（上面的 memCache）＋ MongoDB 的 transit.tdxCache。正式環境是
 * Vercel serverless，function instance 會被回收、記憶體快取說沒就沒，光靠記憶體快取在冷啟動
 * 後形同沒快取，很容易把每分鐘 5 次的額度打滿。Mongo 這層在冷啟動後還在，可以省下重打 TDX。
 * 注意：這不是跨 instance 的鎖，兩個 instance 真的同時冷啟動、同時查同個 path，還是可能各自
 * 打一次 TDX——這個情境很少見，不特別處理。
 */
export function tdxGet<T>(path: string, ttlMs: number = CACHE_TTL_MS): Promise<T> {
  const cached = memCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise as Promise<T>;
  }

  const promise = (async () => {
    const db = await getDb();
    const cacheColl = db.collection<TdxCacheDoc>("transit.tdxCache");

    const cachedDoc = await cacheColl.findOne({ _id: path });
    if (cachedDoc && cachedDoc.expiresAt.getTime() > Date.now()) {
      return cachedDoc.data as T;
    }

    const token = await getAccessToken();
    const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}$format=JSON`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `TDX API 失敗（${path}）：HTTP ${res.status}${errorBody ? ` ${errorBody}` : ""}`,
      );
    }

    const data = (await res.json()) as T;

    // 快取寫入失敗不該讓這次查詢跟著失敗（使用者已經拿到資料了），吞掉錯誤就好；
    // 下一次請求頂多就是沒快取可用、重新打一次 TDX，不是什麼嚴重後果。
    await cacheColl
      .updateOne({ _id: path }, { $set: { data, expiresAt: new Date(Date.now() + ttlMs) } }, { upsert: true })
      .catch(() => {});

    return data;
  })();

  memCache.set(path, {
    promise,
    expiresAt: Date.now() + ttlMs,
  });

  // 失敗不留快取，下一次請求可以重新嘗試。
  promise.catch(() => memCache.delete(path));

  return promise;
}