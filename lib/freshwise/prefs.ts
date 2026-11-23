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
};

/**
 * 使用者可以停留的場所。
 *
 * **只剩一個。** 畫面上不再讓使用者選「傳統市場／超市大賣場／批發市場」：
 * - 批發是菜販的進貨成本，一般人買不到。
 * - 超市大賣場沒有任何公開的架上價，整個場所的數字都是推估的。
 *
 * 現在一律顯示「市場常見價」＝臺中公有零售市場的實際訪價；那裡沒訪到的品項才用批發
 * 價推估，並且在那一列標「估算」。舊的偏好停在別的場所會被搬回來。
 */
const VENUES: VenueKey[] = ["market"];

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
  };
}
