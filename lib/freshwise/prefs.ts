// 使用者偏好的預設值與驗證。純函式，伺服器與瀏覽器共用。
//
// 偏好本來存在 cookie（見 prefs-cookie.ts 的歷史說明），現在跟菜籃、夥伴進度一樣存在
// 帳號底下（freshwise.userData）。這支只負責「一包不知道從哪來的資料，整理成合法的
// 偏好」——資料庫裡可能留著改版前的舊格式，使用者也可能透過 API 送奇怪的值進來。

import type { FreshwisePrefs, UnitKey, VenueKey } from "./types";

export const DEFAULT_PREFS: FreshwisePrefs = {
  venue: "market",
  unit: "catty",
  marketCode: "",
  alertPercent: 15,
};

/** 使用者可以停留的場所。批發不在裡面——它不是可選場所（見 catalog.ts），舊的偏好
 *  如果停在批發會被搬回傳統市場。 */
const VENUES: VenueKey[] = ["market", "super"];

function isVenue(value: unknown): value is VenueKey {
  return typeof value === "string" && VENUES.includes(value as VenueKey);
}

function isUnit(value: unknown): value is UnitKey {
  return value === "catty" || value === "kg";
}

/** 逐欄驗證，壞的退回預設值——一個壞欄位不該讓整組設定重置。 */
export function normalizePrefs(raw: unknown): FreshwisePrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const parsed = raw as Partial<FreshwisePrefs>;
  return {
    venue: isVenue(parsed.venue) ? parsed.venue : DEFAULT_PREFS.venue,
    unit: isUnit(parsed.unit) ? parsed.unit : DEFAULT_PREFS.unit,
    marketCode: typeof parsed.marketCode === "string" ? parsed.marketCode.slice(0, 40) : "",
    alertPercent:
      typeof parsed.alertPercent === "number" && parsed.alertPercent >= 5 && parsed.alertPercent <= 50
        ? Math.round(parsed.alertPercent)
        : DEFAULT_PREFS.alertPercent,
  };
}
