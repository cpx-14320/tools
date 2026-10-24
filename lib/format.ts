export function formatCurrency(n: number): string {
  return `NT$ ${n.toLocaleString("zh-TW")}`;
}

/** 日期顯示成 `2026/10/01`。資料庫裡存的是 `2026-10-01`，橫線是機器格式，畫面上一律
 *  用斜線。 */
export function formatDate(iso: string): string {
  return iso.replaceAll("-", "/");
}

/** 日期區間顯示成 `2026/10/01 ~ 2026/10/31`。只有一邊的時候就只寫那一邊，
 *  兩邊都沒有回傳空字串，由呼叫端決定要顯示什麼。 */
export function formatDateRange(start?: string, end?: string): string {
  if (start && end) return `${formatDate(start)} ~ ${formatDate(end)}`;
  if (start) return `${formatDate(start)} 起`;
  if (end) return `至 ${formatDate(end)}`;
  return "";
}
