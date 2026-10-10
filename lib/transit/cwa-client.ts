// 伺服器端專用：只能從 app/api/** 的 route handler 匯入，絕不能進到 "use client" 檔案，
// 否則 CWA_API_KEY 會被打包進前端 bundle。
const BASE_URL = "https://opendata.cwa.gov.tw/api/v1/rest/datastore";

// 36 小時預報每幾小時才更新一次，不像 TDX 有嚴格的每分鐘次數限制，但還是快取久一點，
// 不要每次切換天氣地區都重打一次。
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

export function cwaGet<T>(path: string, ttlMs: number = CACHE_TTL_MS): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) throw new Error("缺少 CWA_API_KEY 環境變數，請先設定 .env.local");

  const promise = (async () => {
    const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}Authorization=${apiKey}&format=JSON`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CWA API 失敗（${path}）：HTTP ${res.status}`);
    return (await res.json()) as T;
  })();

  cache.set(path, { promise, expiresAt: Date.now() + ttlMs });
  promise.catch(() => cache.delete(path));
  return promise;
}
