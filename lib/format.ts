export function formatCurrency(n: number): string {
  return `NT$ ${n.toLocaleString("zh-TW")}`;
}

/** 日期顯示成 `2026/10/01`。資料庫裡存的是 `2026-10-01`，橫線是機器格式，畫面上一律
 *  用斜線。 */
export function formatDate(iso: string): string {
  return iso.replaceAll("-", "/");
}

const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

/** `YYYY-MM-DD` 是星期幾（`週一`）。
 *
 *  刻意自己拆字串再用本地時間的 `new Date(y, m-1, d)`，不要 `new Date("2026-10-27")`
 *  ——後者會被當成 UTC 午夜，在 UTC+8 看起來沒事，但在美洲時區會倒退一天變成星期日。
 *  用本地時間建構的話不管在哪個時區、伺服器端還是瀏覽器端算出來都一樣，不會 hydration
 *  對不起來。 */
export function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
}

/** 清單的日期小標：`2026/10/27 週一`。純數字的日期看不出是平日還是週末，而「這筆是不是
 *  週末花的」是翻帳本時最常想知道的一件事。
 *
 *  走 formatDate（斜線）而不是直接印 ISO：橫線是資料庫格式，畫面上一律用斜線。以前這裡
 *  直接回傳原字串，所以同一頁的日期欄位寫 `2026/10/30`、清單標頭卻寫 `2026-10-28`。 */
export function formatDateWithWeekday(iso: string): string {
  return `${formatDate(iso)} ${weekdayLabel(iso)}`;
}

/** 年月（`YYYY-MM`）顯示成 `2026/02`。跟 formatDate 同一個規則，只是少了日。 */
export function formatYearMonth(yearMonth: string): string {
  return yearMonth.replaceAll("-", "/");
}

/** 日期區間顯示成 `2026/10/01 ~ 2026/10/31`。只有一邊的時候就只寫那一邊，
 *  兩邊都沒有回傳空字串，由呼叫端決定要顯示什麼。 */
export function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`;
  if (start) return `${formatDate(start)} 起`;
  if (end) return `至 ${formatDate(end)}`;
  return "";
}
