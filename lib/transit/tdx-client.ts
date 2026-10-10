// 伺服器端專用：只能從 app/api/** 的 route handler 匯入，絕不能進到 "use client" 檔案，
// 否則 TDX_CLIENT_SECRET 會被打包進前端 bundle。

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
const cache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

/**
 * 呼叫 TDX 資料 API，path 例如 "/v3/Rail/TRA/StationLiveBoard/Station/1100"（不含 /api/basic 前綴）。
 * ttlMs 可覆寫快取時間——車站清單這種幾乎不會變的靜態資料可以傳更長的 TTL，不要每次都占掉額度。
 */
export function tdxGet<T>(path: string, ttlMs: number = CACHE_TTL_MS): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise as Promise<T>;
  }

  const promise = (async () => {
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

    return (await res.json()) as T;
  })();

  cache.set(path, {
    promise,
    expiresAt: Date.now() + ttlMs,
  });

  // 失敗不留快取，下一次請求可以重新嘗試。
  promise.catch(() => cache.delete(path));

  return promise;
}