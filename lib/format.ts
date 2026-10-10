export function formatCurrency(n: number): string {
  return `NT$ ${n.toLocaleString("zh-TW")}`;
}
