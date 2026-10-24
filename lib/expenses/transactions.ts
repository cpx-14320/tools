// 純邏輯、不碰資料庫——CRUD 在同資料夾的 transactions.server.ts（見 categories.ts 開頭的說明）。

import { dateFilterRange, inDateRange, previousDateFilter, type DateFilter, type DateRange } from "./date-filter";
import { categoryById, topLevelCategories, topLevelCategoryId, type CategoryDTO, type CategoryKind } from "./categories";
import { budgetForMonth, type BudgetRuleDTO } from "./budgets";

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
  /** 這筆錢從哪個帳戶出去／進來——可不填，純粹記錄用途。資產總表的帳戶餘額是即時
   *  從掛了 accountId 的交易加總出來的，見 lib/expenses/accounts.ts 的 accountBalance()。 */
  accountId?: string;
}

export interface TransactionInput {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
  breakdown?: BreakdownItem[];
  accountId?: string;
}

/** 明細淨額：加項加總減去扣項加總，交易金額（amount）就是這個數字。 */
export function breakdownNet(breakdown: BreakdownItem[]): number {
  return breakdown.reduce((sum, item) => sum + (item.kind === "扣項" ? -item.amount : item.amount), 0);
}

/** 交易列表要顯示的「名稱」——使用者不一定每筆都會打備註，沒打的話用分類（或子分類）
 *  名稱頂上去，分類也查不到（被刪除又沒有正確歸類到「未分類」的孤兒資料）才顯示
 *  「（未分類）」，不會整排空白。有備註一律優先顯示備註文案。 */
export function transactionDisplayName(t: TransactionDTO, categories: CategoryDTO[]): string {
  return t.note || categoryById(categories, t.categoryId)?.name || "（未分類）";
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
 *  交易，想看明細（本薪／加班費／勞保／所得稅…）就看那筆交易自己的 breakdown。
 *
 *  查不到分類（分類被刪除後沒有正確歸類到「未分類」留下的孤兒資料——正常流程不會發生，
 *  見 categories.server.ts 的 deleteCategory，但還是防一下）的交易兩邊都不算，不要預設
 *  當成支出：分類是「收入」被刪的話，把它誤判成支出會讓本月收入/支出/結餘整組數字錯開。 */
export function totalsForRange(transactions: TransactionDTO[], categories: CategoryDTO[], range: DateRange | null): RangeTotals {
  const rangeTx = transactionsInDateRange(transactions, range);
  const expenseTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind === "支出");
  const incomeTx = rangeTx.filter((t) => categoryById(categories, t.categoryId)?.kind === "收入");
  const totalExpense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, expenseTx, incomeTx };
}

export interface MonthDelta {
  delta: number;
  pct: number | null; // 上一期是 0 的話百分比沒意義，回傳 null，畫面上只顯示金額差
}

/** 某個彙總指標「這期 vs 比較基準那一期」的差——沒有可比的區間就回傳 null；
 *  比較的那一期完全沒有資料（不是 0，是沒資料）也回傳 null，代表沒東西可比，由呼叫端的
 *  hasPriorData 判斷（通常是消費紀錄或薪資紀錄在那段區間內是否存在）。
 *
 *  compareFilter 不傳就沿用舊行為（比上一期）；傳了就以它為準，讓呼叫端可以依使用者
 *  選的比較基準（去年同期、指定年份同期）決定要跟誰比。 */
export function rangeDelta(
  getValue: (range: DateRange | null) => number,
  filter: DateFilter,
  hasPriorData: (range: DateRange | null) => boolean,
  compareFilter?: DateFilter | null,
): MonthDelta | null {
  const prevFilter = compareFilter === undefined ? previousDateFilter(filter) : compareFilter;
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

/** 某個月的預算使用狀況：預算來自「生效月份」規則（見 budgets.ts 的 budgetForMonth），
 *  不是分類身上的固定值——所以同一個分類在不同月份可以是不同金額。expenseTx 要由呼叫端
 *  先篩成同一個月的，yearMonth 則決定要查哪個月的預算規則。完全沒有分類編過預算時
 *  rows 是空陣列，畫面據此顯示「還沒設定預算」，不會顯示一個全是 0 的空殼卡片。 */
export function budgetSummary(
  expenseTx: TransactionDTO[],
  categories: CategoryDTO[],
  budgetRules: BudgetRuleDTO[],
  yearMonth: string,
): BudgetSummary {
  const spentByCategory = new Map<string, number>();
  for (const t of expenseTx) {
    const topId = topLevelCategoryId(categories, t.categoryId);
    spentByCategory.set(topId, (spentByCategory.get(topId) ?? 0) + t.amount);
  }
  const rows: BudgetRow[] = topLevelCategories(categories, "支出")
    .flatMap((category) => {
      const budgetAmount = budgetForMonth(budgetRules, category.id, yearMonth) ?? 0;
      if (budgetAmount <= 0) return [];
      const spent = spentByCategory.get(category.id) ?? 0;
      return [{ category, budgetAmount, spent, remaining: budgetAmount - spent, pct: Math.round((spent / budgetAmount) * 100) }];
    })
    .sort((a, b) => b.pct - a.pct);
  const totalBudget = rows.reduce((sum, r) => sum + r.budgetAmount, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);
  return { rows, totalBudget, totalSpent, pct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0 };
}


export type TrendGranularity = "day" | "week" | "month" | "year";

export interface TrendPoint {
  label: string;
  start: string;
  end: string;
  total: number;
  byCategory: { categoryId: string; amount: number }[];
}

const trendPad2 = (n: number) => String(n).padStart(2, "0");

function trendDateStr(d: Date): string {
  return `${d.getFullYear()}-${trendPad2(d.getMonth() + 1)}-${trendPad2(d.getDate())}`;
}

/** 這一期（granularity 的第 offset 個週期，0＝今天所在的那一期）的日期範圍跟顯示標籤。
 *  週固定從週一開始算，不是「今天往前推 7 天」的滾動視窗——這樣同一週內不管哪天打開
 *  報表頁，看到的那一期範圍都一樣，不會因為今天是週幾而每天位移。 */
function trendPeriodBounds(granularity: TrendGranularity, offset: number, today: Date): { start: string; end: string; label: string } {
  if (granularity === "day") {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return { start: trendDateStr(d), end: trendDateStr(d), label: `${d.getMonth() + 1}/${d.getDate()}` };
  }
  if (granularity === "week") {
    const dow = today.getDay(); // 0=Sun..6=Sat
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset + offset * 7);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: trendDateStr(monday), end: trendDateStr(sunday), label: `${monday.getMonth() + 1}/${monday.getDate()}` };
  }
  if (granularity === "month") {
    const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
    return { start: trendDateStr(start), end: trendDateStr(end), label: `${start.getMonth() + 1}月` };
  }
  const year = today.getFullYear() + offset;
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}` };
}

/** 近 periods 期（依 granularity 切）各自的起訖與標籤，最後一筆是「現在這一期」。
 *  收支趨勢跟資產趨勢共用同一組期間，兩張圖的 X 軸才會對得起來。 */
export function trendPeriods(granularity: TrendGranularity, periods: number, today = new Date()): { start: string; end: string; label: string }[] {
  const list: { start: string; end: string; label: string }[] = [];
  for (let offset = -(periods - 1); offset <= 0; offset++) {
    list.push(trendPeriodBounds(granularity, offset, today));
  }
  return list;
}

/** 近 periods 期（依 granularity 切）的收支趨勢，每一期再依頂層分類拆開——畫堆疊長條圖用。
 *  只看指定 kind（支出或收入）的交易；「淨額」趨勢不是這個函式的事，呼叫端自己各呼叫一次
 *  支出、一次收入，用兩邊的 total 相減即可，不需要這裡再多一種「淨額模式」。 */
export function trendByPeriod(
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  kind: CategoryKind,
  granularity: TrendGranularity,
  periods: number,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const { start, end, label } of trendPeriods(granularity, periods)) {
    const rangeTx = transactionsInDateRange(transactions, { start, end }).filter(
      (t) => categoryById(categories, t.categoryId)?.kind === kind,
    );
    const byCategory = new Map<string, number>();
    for (const t of rangeTx) {
      const topId = topLevelCategoryId(categories, t.categoryId);
      byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
    }
    points.push({
      label,
      start,
      end,
      total: [...byCategory.values()].reduce((a, b) => a + b, 0),
      byCategory: [...byCategory.entries()].map(([categoryId, amount]) => ({ categoryId, amount })),
    });
  }
  return points;
}

export interface SubcategoryRow {
  id: string;
  name: string;
  amount: number;
  /** 佔這個大分類的百分比。 */
  pct: number;
}

/** 某個大分類底下，各子分類各花了多少——報表的分類明細展開時用。
 *
 *  只列子分類。直接記在大分類身上的錢不列：有子分類的大分類現在建立時就一定要挑到
 *  項目（見 categories.ts 的 needsSubcategory），記在殼身上的只剩擋下這條規則之前的
 *  舊資料，為了那幾筆多掛一列「直接記在這一類」，反而讓每次展開都多一行看不懂的東西。
 *  百分比是在列出來的這些子分類之間算的，所以還是會加到 100%。 */
export function subcategoryBreakdown(transactions: TransactionDTO[], categories: CategoryDTO[], parentId: string): SubcategoryRow[] {
  const byId = new Map<string, number>();
  for (const t of transactions) {
    if (t.categoryId === parentId) continue;
    if (topLevelCategoryId(categories, t.categoryId) !== parentId) continue;
    byId.set(t.categoryId, (byId.get(t.categoryId) ?? 0) + t.amount);
  }
  const total = [...byId.values()].reduce((a, b) => a + b, 0) || 1;
  return [...byId.entries()]
    .map(([id, amount]) => ({
      id,
      name: categoryById(categories, id)?.name ?? "（已刪除分類）",
      amount,
      pct: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}
