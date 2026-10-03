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

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TDX 換取 token 失敗：HTTP ${res.status}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  // 提前 60 秒視為過期，避免卡在剛好過期那一刻送出請求。
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
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
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

  const promise = (async () => {
    const token = await getAccessToken();
    const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}$format=JSON`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`TDX API 失敗（${path}）：HTTP ${res.status}`);
    return (await res.json()) as T;
  })();

  cache.set(path, { promise, expiresAt: Date.now() + ttlMs });
  promise.catch(() => cache.delete(path));
  return promise;
}
