// 純邏輯、不碰資料庫——CRUD 在同資料夾的 transactions.server.ts（見 categories.ts 開頭的說明）。

import { dateFilterRange, inDateRange, previousDateFilter, type DateFilter, type DateRange } from "./date-filter";
import { categoryById, topLevelCategories, topLevelCategoryId, type CategoryDTO } from "./categories";

export interface TransactionDTO {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface TransactionInput {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
}

export function transactionsInDateRange(transactions: TransactionDTO[], range: DateRange | null): TransactionDTO[] {
  return transactions.filter((t) => inDateRange(t.date, range)).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface RangeTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenseTx: TransactionDTO[];
  incomeTx: TransactionDTO[];
  salaryIncome: number;
  extraIncome: number;
}

/** 指定區間的總收入／總支出／結餘。收入＝薪資淨額（由呼叫端算好傳進來）＋收入類分類的
 *  Transaction（股息、接案、紅包…）；支出＝支出類分類的 Transaction。 */
export function totalsForRange(
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  range: DateRange | null,
  salaryIncome: number,
): RangeTotals {
  const rangeTx = transactionsInDateRange(transactions, range);
  const expenseTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind !== "收入");
  const incomeTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind === "收入");
  const totalExpense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
  const extraIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = salaryIncome + extraIncome;
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, expenseTx, incomeTx, salaryIncome, extraIncome };
}

export interface MonthDelta {
  delta: number;
  pct: number | null; // 上一期是 0 的話百分比沒意義，回傳 null，畫面上只顯示金額差
}

/** 某個彙總指標「這期 vs 上一期」的差——全部／自訂模式沒有「上一期」就回傳 null；
 *  上一期完全沒有資料（不是 0，是沒資料）也回傳 null，代表沒東西可比，由呼叫端的
 *  hasPriorData 判斷（通常是消費紀錄或薪資紀錄在上一期區間內是否存在）。 */
export function rangeDelta(
  getValue: (range: DateRange | null) => number,
  filter: DateFilter,
  hasPriorData: (range: DateRange | null) => boolean,
): MonthDelta | null {
  const prevFilter = previousDateFilter(filter);
  if (!prevFilter) return null;
  const prevRange = dateFilterRange(prevFilter);
  if (!hasPriorData(prevRange)) return null;
  const current = getValue(dateFilterRange(filter));
  const previous = getValue(prevRange);
  return { delta: current - previous, pct: previous === 0 ? null : ((current - previous) / previous) * 100 };
}

/** 消費分類佔比：子分類的金額算到它的大分類底下，這裡只回傳支出類大分類層級的彙總
 *  （例如「網購」底下的 3C家電／服飾美妝／日用雜貨全部合併顯示成一筆「網購」）。 */
export function categoryBreakdown(expenseTx: TransactionDTO[], categories: CategoryDTO[]) {
  const byCategory = new Map<string, number>();
  for (const t of expenseTx) {
    const topId = topLevelCategoryId(categories, t.categoryId);
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
  }
  const total = [...byCategory.values()].reduce((a, b) => a + b, 0) || 1;
  return topLevelCategories(categories, "支出")
    .map((c) => ({ category: c, amount: byCategory.get(c.id) ?? 0 }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((row) => ({ ...row, pct: Math.round((row.amount / total) * 100) }));
}

/** 收入來源佔比：薪資（淨額算一筆「薪資」）＋各收入分類，想看整體收入怎麼來的用。 */
export function incomeBreakdown(incomeTx: TransactionDTO[], categories: CategoryDTO[], salaryIncome: number) {
  const byCategory = new Map<string, number>();
  for (const t of incomeTx) {
    const topId = topLevelCategoryId(categories, t.categoryId);
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
  }
  const rows: { id: string; name: string; icon: string; amount: number }[] = [];
  if (salaryIncome > 0) rows.push({ id: "salary", name: "薪資", icon: "💰", amount: salaryIncome });
  for (const c of topLevelCategories(categories, "收入")) {
    const amount = byCategory.get(c.id) ?? 0;
    if (amount > 0) rows.push({ id: c.id, name: c.name, icon: c.icon, amount });
  }
  const total = rows.reduce((sum, r) => sum + r.amount, 0) || 1;
  return rows.sort((a, b) => b.amount - a.amount).map((row) => ({ ...row, pct: Math.round((row.amount / total) * 100) }));
}

/** 單一大分類底下，每個子分類在這個區間各花多少——分類管理頁展開大分類時用。 */
export function subcategoryBreakdown(expenseTx: TransactionDTO[], categories: CategoryDTO[], parentId: string) {
  const subs = categories.filter((c) => c.parentId === parentId);
  const byCategory = new Map<string, number>();
  for (const t of expenseTx) {
    if (t.categoryId === parentId || subs.some((s) => s.id === t.categoryId)) {
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  return [{ id: parentId, name: "（未分子分類）" }, ...subs]
    .map((c) => ({ id: c.id, name: c.name, amount: byCategory.get(c.id) ?? 0 }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
