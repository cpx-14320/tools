// 純邏輯、不碰資料庫——CRUD 在同資料夾的 transactions.server.ts（見 categories.ts 開頭的說明）。

import { dateFilterRange, inDateRange, previousDateFilter, type DateFilter, type DateRange } from "./date-filter";
import { categoryById, topLevelCategories, topLevelCategoryId, type CategoryDTO } from "./categories";

export type BreakdownKind = "加項" | "扣項";

/** 一筆交易底下的子項明細——例如薪資轉帳這筆交易，可以附上「本薪／加班費／獎金」幾個
 *  加項跟「勞保／健保／所得稅」幾個扣項，交易本身的金額就是這些明細算出來的淨額。
 *  這是依附在交易上的輔助資訊，不是獨立的資料表，沒有自己的 CRUD／管理頁。 */
export interface BreakdownItem {
  label: string;
  kind: BreakdownKind;
  amount: number;
}

export interface TransactionDTO {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
  /** 由固定收支規則（lib/expenses/recurring-rules.ts）確認存入產生時才有值；一般手動
   *  新增／CSV 匯入的交易不會有這個欄位，不能透過一般的新增／編輯 API 設定它。 */
  sourceRuleId?: string;
  /** 有填的話，amount 一律是 breakdownNet(breakdown) 算出來的值，不能獨立編輯——
   *  見 transactions.server.ts 的 createTransaction／updateTransaction。 */
  breakdown?: BreakdownItem[];
}

export interface TransactionInput {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
  breakdown?: BreakdownItem[];
}

/** 明細淨額：加項加總減去扣項加總，交易金額（amount）就是這個數字。 */
export function breakdownNet(breakdown: BreakdownItem[]): number {
  return breakdown.reduce((sum, item) => sum + (item.kind === "扣項" ? -item.amount : item.amount), 0);
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
}

/** 指定區間的總收入／總支出／結餘。收入＝支出類以外（即「收入」分類，含薪資）的
 *  Transaction 加總；薪資不再是另外算好傳進來的特例，就是一筆分類為「薪資」的一般收入
 *  交易，想看明細（本薪／加班費／勞保／所得稅…）就看那筆交易自己的 breakdown。 */
export function totalsForRange(transactions: TransactionDTO[], categories: CategoryDTO[], range: DateRange | null): RangeTotals {
  const rangeTx = transactionsInDateRange(transactions, range);
  const expenseTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind !== "收入");
  const incomeTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind === "收入");
  const totalExpense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, expenseTx, incomeTx };
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

/** 收入來源佔比：各收入分類（薪資也只是其中一個分類）加總，想看整體收入怎麼來的用。 */
export function incomeBreakdown(incomeTx: TransactionDTO[], categories: CategoryDTO[]) {
  const byCategory = new Map<string, number>();
  for (const t of incomeTx) {
    const topId = topLevelCategoryId(categories, t.categoryId);
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
  }
  const rows: { id: string; name: string; icon: string; amount: number }[] = [];
  for (const c of topLevelCategories(categories, "收入")) {
    const amount = byCategory.get(c.id) ?? 0;
    if (amount > 0) rows.push({ id: c.id, name: c.name, icon: c.icon, amount });
  }
  const total = rows.reduce((sum, r) => sum + r.amount, 0) || 1;
  return rows.sort((a, b) => b.amount - a.amount).map((row) => ({ ...row, pct: Math.round((row.amount / total) * 100) }));
}

export interface BudgetRow {
  category: CategoryDTO;
  budgetAmount: number;
  spent: number;
  remaining: number;
  pct: number; // 可能超過 100，代表已經超支
}

export interface BudgetSummary {
  rows: BudgetRow[];
  totalBudget: number;
  totalSpent: number;
  pct: number;
}

/** 本月預算使用狀況：只看有設定 budgetAmount 的頂層支出分類，用同一個月的 expenseTx
 *  （呼叫端自己先依日期篩選器篩過）比對實際花了多少。完全沒有分類設過預算時
 *  rows 是空陣列，畫面據此顯示「還沒設定預算」，不會顯示一個全是 0 的空殼卡片。 */
export function budgetSummary(expenseTx: TransactionDTO[], categories: CategoryDTO[]): BudgetSummary {
  const spentByCategory = new Map<string, number>();
  for (const t of expenseTx) {
    const topId = topLevelCategoryId(categories, t.categoryId);
    spentByCategory.set(topId, (spentByCategory.get(topId) ?? 0) + t.amount);
  }
  const budgeted = topLevelCategories(categories, "支出").filter((c) => (c.budgetAmount ?? 0) > 0);
  const rows: BudgetRow[] = budgeted
    .map((category) => {
      const budgetAmount = category.budgetAmount as number;
      const spent = spentByCategory.get(category.id) ?? 0;
      return { category, budgetAmount, spent, remaining: budgetAmount - spent, pct: Math.round((spent / budgetAmount) * 100) };
    })
    .sort((a, b) => b.pct - a.pct);
  const totalBudget = rows.reduce((sum, r) => sum + r.budgetAmount, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);
  return { rows, totalBudget, totalSpent, pct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0 };
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
