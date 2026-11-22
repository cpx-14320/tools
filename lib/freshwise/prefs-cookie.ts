// 使用者偏好（場所／單位／市場…）存在 cookie 裡的讀寫。
//
// ## 為什麼從 localStorage 換成 cookie
//
// 接上真實行情之後，價格只能在伺服器端算（要讀 MongoDB）。而「要算哪個場所、哪個市場
// 的價格」是使用者的偏好——伺服器讀不到 localStorage，就只能先用預設值算一份、送到瀏覽器
// 之後再發現使用者其實選的是別的場所，然後重新抓一次。那會變成每次進頁面都閃一下。
//
// cookie 是瀏覽器每次請求都會自動帶上的，所以 Server Component 第一次算繪就知道使用者
// 要看什麼，一次就算對。順便也解決了原本的限制：第一次畫面不會再是預設的「傳統市場・
// 台斤」然後跳走。
//
// 這不是「把使用者資料搬到 cookie」——偏好只有五個小欄位（整包不到 100 bytes），而且
// 本來就要跟著每個請求走。菜籃（會成長的清單）仍然留在 localStorage。

import type { FreshwisePrefs, UnitKey, VenueKey } from "./types";

export const PREFS_COOKIE = "freshwise_prefs";

/** cookie 存一年。偏好不是機密、也不需要 httpOnly（前端要讀它來同步 UI），但一定要
 *  SameSite=Lax，不然跨站請求也會帶上去。 */
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export const DEFAULT_PREFS: FreshwisePrefs = {
  venue: "market",
  unit: "catty",
  marketCode: "",
  alertPercent: 15,
};

const VENUES: VenueKey[] = ["market", "super", "wholesale"];

function isVenue(value: unknown): value is VenueKey {
  return typeof value === "string" && VENUES.includes(value as VenueKey);
}

function isUnit(value: unknown): value is UnitKey {
  return value === "catty" || value === "kg";
}

/**
 * 解析 cookie 的值。每個欄位逐一驗證、壞的退回預設值——cookie 的內容是使用者改得到的，
 * 而且我們自己改版時也可能留下舊格式（例如之後新增第四種場所又移除），一個壞欄位不該
 * 讓整組設定重置。
 */
export function parsePrefs(raw: string | undefined): FreshwisePrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<FreshwisePrefs>;
    return {
      venue: isVenue(parsed.venue) ? parsed.venue : DEFAULT_PREFS.venue,
      unit: isUnit(parsed.unit) ? parsed.unit : DEFAULT_PREFS.unit,
      marketCode: typeof parsed.marketCode === "string" ? parsed.marketCode.slice(0, 40) : "",
      alertPercent:
        typeof parsed.alertPercent === "number" && parsed.alertPercent >= 5 && parsed.alertPercent <= 50
          ? Math.round(parsed.alertPercent)
          : DEFAULT_PREFS.alertPercent,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(prefs: FreshwisePrefs): string {
  return encodeURIComponent(JSON.stringify(prefs));
}

/** 瀏覽器端寫 cookie。只有這一支會寫，所以 path／max-age／SameSite 只有一個定義。 */
export function writePrefsCookie(prefs: FreshwisePrefs): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PREFS_COOKIE}=${serializePrefs(prefs)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

/** 瀏覽器端讀 cookie。伺服器送下來的 props 已經是同一份值，這支是給「同一個分頁裡換了
 *  設定、還沒重新算繪」的情況對齊用。 */
export function readPrefsCookie(): FreshwisePrefs {
  if (typeof document === "undefined") return DEFAULT_PREFS;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${PREFS_COOKIE}=`));
  return parsePrefs(match?.slice(PREFS_COOKIE.length + 1));
}
