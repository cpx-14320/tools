import { NextResponse } from "next/server";

/**
 * 給 app/api/transit/** 的 GET 端點用的瀏覽器快取時間。
 *
 * 伺服器端本來就有 TDX／CWA 的快取（lib/transit/tdx-client.ts、cwa-client.ts），但那層
 * 只擋得住「真的去打外部 API」；瀏覽器每次換頁、每次重新打開彈窗還是會重新發一次請求到
 * 我們自己的 API route，一樣要跑一趟 serverless function＋Mongo 查詢。幾個真正常見的
 * 重複請求就是這樣來的：
 *   - 首頁掛載、常用行程編輯彈窗、搜尋結果頁「加入行程」各自都會打一次 /tra/stations
 *   - 同一條公車路線在選擇彈窗看過站序、按下去到結果頁又查一次 /bus/route-stops
 * 回應掛上 Cache-Control 之後，這些重複請求在快取有效期內直接由瀏覽器的 HTTP 快取回答，
 * 連請求都不會送出去。
 *
 * 一律用 `private`：這些回應跟登入的使用者有關（或至少不該被共用的 CDN 快取起來）。
 * 時間長度照資料本身多久會變分級，跟 TDX_TTL 的分級對應。
 */
export const API_CACHE = {
  /** 車站清單、Ubike 站點這種幾乎不會變的靜態清單。 */
  static: "private, max-age=86400",
  /** 路線／站牌名稱搜尋結果：清單本身幾乎不變，但使用者打字會一直換關鍵字，不用放太久。 */
  search: "private, max-age=300",
  /** 某一天的時刻表。 */
  timetable: "private, max-age=300",
  /** 帶即時到站時間的回應——比照伺服器端 60 秒的新鮮度，再抓短一點。 */
  realtime: "private, max-age=30",
  /** 天氣預報（CWA 本身幾小時才更新一次）。 */
  weather: "private, max-age=1800",
} as const;

/** 等同 NextResponse.json，但一併掛上 Cache-Control。 */
export function jsonCached<T>(data: T, cacheControl: string, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status,
    headers: { "Cache-Control": cacheControl },
  });
}
