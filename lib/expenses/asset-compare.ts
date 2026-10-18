// 純邏輯、不碰資料庫——CRUD 在同資料夾的 *.server.ts（見 categories.ts 開頭的說明）。
//
// 資產頁的「比較」跟消費那邊的 CompareMode（lib/expenses/date-filter.ts）概念不同：消費
// 比的是「這一段 vs 另一段」的加總，資產比的是「現在 vs 某一個時間點」的餘額差——淨資產
// 本身沒有「這個月的淨資產」這種區間加總的概念，只有「某一天當時的淨資產是多少」。
// 所以這裡只需要算出一個基準日期，而不是一整個 DateFilter。
//
// 算「某天當時的餘額」不需要額外的資料結構：既有的 accountBalance／netWorth／totalByKind
// 本來就是「傳進去哪些交易／轉帳，就算哪些」，呼叫端把 transactions／transfers 篩成
// 「日期 <= 基準日」的子集合再傳進去，就是那一天當時的餘額（見 accounts.ts 的說明）。

export type AssetCompareMode = "lastMonthEnd" | "lastYear" | "custom" | "none";

export interface AssetCompareSetting {
  mode: AssetCompareMode;
  /** mode === "custom" 時才有意義，格式 YYYY-MM-DD。 */
  customDate: string;
}

export function defaultAssetCompareSetting(): AssetCompareSetting {
  return { mode: "lastMonthEnd", customDate: "" };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 依照比較設定，算出要拿「哪一天當時的餘額」來跟現在比。回傳 null 代表不比較。 */
export function assetCompareDate(setting: AssetCompareSetting, today: string): string | null {
  const [y, m, d] = today.split("-").map(Number);
  switch (setting.mode) {
    case "none":
      return null;
    case "lastMonthEnd":
      // new Date(y, m-1, 0) 是「這個月第 0 天」，也就是上個月最後一天——沿用
      // recurring-rules.ts 的 occurrenceDate 同一種「借用 JS Date 溢位規則」的寫法。
      return toDateStr(new Date(y, m - 1, 0));
    case "lastYear":
      return toDateStr(new Date(y - 1, m - 1, d));
    case "custom":
      return setting.customDate || null;
  }
}

/** 比較基準的說明文字——KPI 卡片旁邊的漲跌幅要讓使用者知道現在是跟哪一天比。 */
export function assetCompareLabel(setting: AssetCompareSetting): string {
  switch (setting.mode) {
    case "none":
      return "不比較";
    case "lastMonthEnd":
      return "vs 上月底";
    case "lastYear":
      return "vs 去年同日";
    case "custom":
      return setting.customDate ? `vs ${setting.customDate}` : "vs 指定日期";
  }
}
