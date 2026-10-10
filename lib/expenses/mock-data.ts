// 靜態頁面階段的示範資料，欄位形狀對齊 PLANNING.html 的資料模型（User/Ledger/ExpenseCategory/
// SalaryItemType/SalaryRecord/Transaction），之後串資料庫時直接把這些函式換成真的查詢即可。

export type CategoryColor = "a" | "b" | "c" | "d" | "e" | "f";

export type CategoryKind = "支出" | "收入";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: CategoryColor;
  /** 支出分類（餐飲、房租…）還是收入分類（投資、接案…）；薪資不算在這裡，薪資走獨立的
   *  SalaryRecord／SalaryItemType，這裡的「收入」分類專門給薪資以外的額外收入用。 */
  kind: CategoryKind;
  /** 有值代表這是某個分類底下的子分類（目前只做兩層：分類／子分類，子分類不能再有子分類）。 */
  parentId?: string;
}

export interface SalaryItemType {
  id: string;
  name: string;
  kind: "加項" | "扣項";
}

export interface Member {
  id: string;
  name: string;
  role: "owner" | "member";
}

export interface Transaction {
  id: string;
  categoryId: string;
  memberId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
}

export interface SalaryRecord {
  id: string;
  memberId: string;
  yearMonth: string; // YYYY-MM
  items: { typeId: string; amount: number }[];
}

export const ledger = {
  name: "我們家的帳本",
  inviteCode: "HM3K9X",
};

export const members: Member[] = [
  { id: "m1", name: "陳柏翰", role: "owner" },
  { id: "m2", name: "林雨柔", role: "member" },
];

// 兩層分類：大分類（parentId 不填）＋ 子分類（parentId 指向大分類）。像「網購」這種大分類下
// 常常會想再細看是哪種類型消費多，就新增子分類；不需要細分的大分類（餐飲、房租…）不用給子分類。
// 每個分類都有 kind：支出分類跟收入分類分開管理，互不混用。
export const categories: ExpenseCategory[] = [
  { id: "c1", name: "餐飲", icon: "🍜", color: "a", kind: "支出" },
  { id: "c2", name: "交通", icon: "🚌", color: "b", kind: "支出" },
  { id: "c3", name: "房租", icon: "🏠", color: "c", kind: "支出" },
  { id: "c4", name: "娛樂", icon: "🎮", color: "d", kind: "支出" },
  { id: "c5", name: "網購", icon: "🛍️", color: "e", kind: "支出" },
  { id: "c5a", name: "3C家電", icon: "💻", color: "e", kind: "支出", parentId: "c5" },
  { id: "c5b", name: "服飾美妝", icon: "👗", color: "e", kind: "支出", parentId: "c5" },
  { id: "c5c", name: "日用雜貨", icon: "🧴", color: "e", kind: "支出", parentId: "c5" },
  { id: "c6", name: "醫療", icon: "🏥", color: "f", kind: "支出" },
  { id: "c7", name: "信用卡卡費", icon: "💳", color: "c", kind: "支出" },
  { id: "c8", name: "水電費", icon: "💡", color: "b", kind: "支出" },

  { id: "c9", name: "投資理財", icon: "📈", color: "e", kind: "收入" },
  { id: "c10", name: "接案收入", icon: "💼", color: "b", kind: "收入" },
  { id: "c11", name: "禮金紅包", icon: "🧧", color: "d", kind: "收入" },
  { id: "c12", name: "其他收入", icon: "💵", color: "a", kind: "收入" },
];

export function topLevelCategories(kind?: CategoryKind): ExpenseCategory[] {
  return categories.filter((c) => !c.parentId && (kind === undefined || c.kind === kind));
}

export function subCategoriesOf(parentId: string): ExpenseCategory[] {
  return categories.filter((c) => c.parentId === parentId);
}

/** 分類顯示用路徑：子分類回傳「大分類 › 子分類」，大分類直接回傳自己的名字。 */
export function categoryPath(id: string): string {
  const cat = categoryById(id);
  if (!cat) return "（已刪除分類）";
  if (!cat.parentId) return cat.name;
  const parent = categoryById(cat.parentId);
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

/** 子分類算到它的大分類底下，拿不到大分類（理論上不會發生）就算它自己——給「消費分類佔比」這種
 *  只看大分類的彙總畫面用；要看子分類細節到分類管理頁，那裡會列出每個大分類底下的子分類明細。 */
export function topLevelCategoryId(id: string): string {
  const cat = categoryById(id);
  return cat?.parentId ?? id;
}

export const categoryColorClass: Record<CategoryColor, string> = {
  a: "bg-cat-a-bg text-cat-a-fg",
  b: "bg-cat-b-bg text-cat-b-fg",
  c: "bg-cat-c-bg text-cat-c-fg",
  d: "bg-cat-d-bg text-cat-d-fg",
  e: "bg-cat-e-bg text-cat-e-fg",
  f: "bg-cat-f-bg text-cat-f-fg",
};

// Tailwind 要在原始碼看到完整字串才會產生對應 class，不能用字串拼接／replace 動態組出 bg-cat-a-fg
// 這種名稱，所以額外列一份「純色塊」版本給進度條這類只需要單色填滿的地方用。
export const categoryFillClass: Record<CategoryColor, string> = {
  a: "bg-cat-a-fg",
  b: "bg-cat-b-fg",
  c: "bg-cat-c-fg",
  d: "bg-cat-d-fg",
  e: "bg-cat-e-fg",
  f: "bg-cat-f-fg",
};

export const salaryItemTypes: SalaryItemType[] = [
  { id: "s1", name: "本薪", kind: "加項" },
  { id: "s2", name: "獎金", kind: "加項" },
  { id: "s3", name: "加班費", kind: "加項" },
  { id: "s4", name: "勞健保", kind: "扣項" },
  { id: "s5", name: "請假扣款", kind: "扣項" },
];

export const transactions: Transaction[] = [
  { id: "t1", categoryId: "c3", memberId: "m1", amount: 18000, date: "2026-10-01", note: "10 月房租" },
  { id: "t2", categoryId: "c1", memberId: "m1", amount: 185, date: "2026-10-01", note: "早餐＋晚餐" },
  { id: "t3", categoryId: "c2", memberId: "m2", amount: 1280, date: "2026-10-02", note: "悠遊卡加值" },
  { id: "t4", categoryId: "c5c", memberId: "m2", amount: 2450, date: "2026-10-03", note: "日用品採買" },
  { id: "t5", categoryId: "c1", memberId: "m2", amount: 420, date: "2026-10-03" },
  { id: "t6", categoryId: "c4", memberId: "m1", amount: 890, date: "2026-10-04", note: "電影＋晚餐" },
  { id: "t7", categoryId: "c6", memberId: "m1", amount: 650, date: "2026-10-05", note: "牙醫" },
  { id: "t8", categoryId: "c1", memberId: "m1", amount: 310, date: "2026-10-06" },
  { id: "t9", categoryId: "c2", memberId: "m1", amount: 320, date: "2026-10-06", note: "停車費" },
  { id: "t10", categoryId: "c1", memberId: "m2", amount: 265, date: "2026-10-07" },
  { id: "t15", categoryId: "c7", memberId: "m1", amount: 1200, date: "2026-10-08", note: "信用卡年費" },
  { id: "t16", categoryId: "c8", memberId: "m1", amount: 1850, date: "2026-10-08", note: "10 月電費" },
  { id: "t17", categoryId: "c5a", memberId: "m2", amount: 3990, date: "2026-10-09", note: "藍牙耳機" },

  { id: "t11", categoryId: "c3", memberId: "m1", amount: 18000, date: "2026-09-01", note: "9 月房租" },
  { id: "t12", categoryId: "c1", memberId: "m2", amount: 540, date: "2026-09-02" },
  { id: "t13", categoryId: "c5b", memberId: "m1", amount: 1680, date: "2026-09-05", note: "換季衣物" },
  { id: "t14", categoryId: "c4", memberId: "m2", amount: 1200, date: "2026-09-12", note: "演唱會周邊" },
  { id: "t18", categoryId: "c8", memberId: "m1", amount: 1720, date: "2026-09-08", note: "9 月電費" },

  // 薪資以外的額外收入，走一樣的 Transaction，只是分類是「收入」類。
  { id: "t19", categoryId: "c9", memberId: "m1", amount: 4200, date: "2026-10-05", note: "股息入帳" },
  { id: "t20", categoryId: "c10", memberId: "m2", amount: 8000, date: "2026-10-15", note: "接案尾款" },
  { id: "t21", categoryId: "c11", memberId: "m1", amount: 3600, date: "2026-09-20", note: "長輩紅包" },
];

export const salaryRecords: SalaryRecord[] = [
  {
    id: "sr1",
    memberId: "m1",
    yearMonth: "2026-10",
    items: [
      { typeId: "s1", amount: 52000 },
      { typeId: "s3", amount: 3200 },
      { typeId: "s4", amount: 1273 },
    ],
  },
  {
    id: "sr2",
    memberId: "m2",
    yearMonth: "2026-10",
    items: [
      { typeId: "s1", amount: 46000 },
      { typeId: "s2", amount: 5000 },
      { typeId: "s4", amount: 1157 },
      { typeId: "s5", amount: 920 },
    ],
  },
  {
    id: "sr3",
    memberId: "m1",
    yearMonth: "2026-09",
    items: [
      { typeId: "s1", amount: 52000 },
      { typeId: "s4", amount: 1273 },
    ],
  },
  {
    id: "sr4",
    memberId: "m2",
    yearMonth: "2026-09",
    items: [
      { typeId: "s1", amount: 46000 },
      { typeId: "s4", amount: 1157 },
    ],
  },

  // 補滿全年，給「年度薪資趨勢」圖表用。陳柏翰 7 月起本薪調整 50000→52000；
  // 林雨柔 4 月起本薪調整 44000→46000。兩人都在 6 月、12 月有獎金，其餘月份明細組成不固定。
  { id: "sr5", memberId: "m1", yearMonth: "2026-01", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr6", memberId: "m2", yearMonth: "2026-01", items: [{ typeId: "s1", amount: 44000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr7", memberId: "m1", yearMonth: "2026-02", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s3", amount: 1500 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr8", memberId: "m2", yearMonth: "2026-02", items: [{ typeId: "s1", amount: 44000 }, { typeId: "s4", amount: 1157 }, { typeId: "s5", amount: 300 }] },

  { id: "sr9", memberId: "m1", yearMonth: "2026-03", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s4", amount: 1273 }, { typeId: "s5", amount: 600 }] },
  { id: "sr10", memberId: "m2", yearMonth: "2026-03", items: [{ typeId: "s1", amount: 44000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr11", memberId: "m1", yearMonth: "2026-04", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr12", memberId: "m2", yearMonth: "2026-04", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr13", memberId: "m1", yearMonth: "2026-05", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s3", amount: 2200 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr14", memberId: "m2", yearMonth: "2026-05", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr15", memberId: "m1", yearMonth: "2026-06", items: [{ typeId: "s1", amount: 50000 }, { typeId: "s2", amount: 8000 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr16", memberId: "m2", yearMonth: "2026-06", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s2", amount: 6000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr17", memberId: "m1", yearMonth: "2026-07", items: [{ typeId: "s1", amount: 52000 }, { typeId: "s4", amount: 1273 } ] },
  { id: "sr18", memberId: "m2", yearMonth: "2026-07", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s4", amount: 1157 }, { typeId: "s5", amount: 920 }] },

  { id: "sr19", memberId: "m1", yearMonth: "2026-08", items: [{ typeId: "s1", amount: 52000 }, { typeId: "s4", amount: 1273 }, { typeId: "s5", amount: 450 }] },
  { id: "sr20", memberId: "m2", yearMonth: "2026-08", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr21", memberId: "m1", yearMonth: "2026-11", items: [{ typeId: "s1", amount: 52000 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr22", memberId: "m2", yearMonth: "2026-11", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s4", amount: 1157 }] },

  { id: "sr23", memberId: "m1", yearMonth: "2026-12", items: [{ typeId: "s1", amount: 52000 }, { typeId: "s2", amount: 25000 }, { typeId: "s3", amount: 1800 }, { typeId: "s4", amount: 1273 }] },
  { id: "sr24", memberId: "m2", yearMonth: "2026-12", items: [{ typeId: "s1", amount: 46000 }, { typeId: "s2", amount: 20000 }, { typeId: "s4", amount: 1157 }] },
];

/** 年度薪資趨勢：回傳指定年份 1-12 月每位成員的淨額，沒有紀錄的月份算 0。 */
export function yearlySalaryTrend(year: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const yearMonth = `${year}-${month}`;
    const byMember = Object.fromEntries(
      members.map((m) => {
        const record = salaryRecords.find((r) => r.yearMonth === yearMonth && r.memberId === m.id);
        return [m.id, record ? salaryNet(record) : 0];
      }),
    );
    return { month: i + 1, yearMonth, ...byMember } as { month: number; yearMonth: string } & Record<string, number>;
  });
}

export function memberName(id: string): string {
  return members.find((m) => m.id === id)?.name ?? "（已刪除成員）";
}

export function categoryById(id: string): ExpenseCategory | undefined {
  return categories.find((c) => c.id === id);
}

export function salaryItemTypeById(id: string): SalaryItemType | undefined {
  return salaryItemTypes.find((t) => t.id === id);
}

export function salaryNet(record: SalaryRecord): number {
  return record.items.reduce((sum, i) => {
    const type = salaryItemTypeById(i.typeId);
    return sum + (type?.kind === "扣項" ? -i.amount : i.amount);
  }, 0);
}

function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 某位成員「這個月 vs 上個月」的淨額差——上個月沒有紀錄就回傳 null（沒東西可比）。
 *  只用在月模式的薪資卡片，薪資本來就是按月記錄，年／日／全部／自訂模式不適用。 */
export function monthOverMonthDelta(memberId: string, yearMonth: string): { delta: number; pct: number } | null {
  const current = salaryRecords.find((r) => r.memberId === memberId && r.yearMonth === yearMonth);
  const prevYearMonth = shiftYearMonth(yearMonth, -1);
  const previous = salaryRecords.find((r) => r.memberId === memberId && r.yearMonth === prevYearMonth);
  if (!current || !previous) return null;
  const currentNet = salaryNet(current);
  const previousNet = salaryNet(previous);
  if (previousNet === 0) return null;
  return { delta: currentNet - previousNet, pct: ((currentNet - previousNet) / previousNet) * 100 };
}

// ── 日期區間篩選（年／月／日／全部／自訂）──────────────────────────────
// 原本只有「年月」一種篩選粒度，現在拓寬成五種模式；底層統一轉成一個
// inclusive 的 [start, end]（YYYY-MM-DD）日期區間，null 代表「全部」不篩選，
// 其餘函式都只認得這個區間，不用再個別處理每種模式。

export type DateFilterMode = "year" | "month" | "day" | "all" | "custom";

export interface DateFilter {
  mode: DateFilterMode;
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  customStart: string; // YYYY-MM-DD
  customEnd: string; // YYYY-MM-DD
}

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function defaultDateFilter(): DateFilter {
  return { mode: "month", year: 2026, month: 10, day: 1, customStart: "2026-10-01", customEnd: "2026-10-31" };
}

/** 篩選器目前代表的曆月（YYYY-MM）——不管是哪個模式都有意義的「參考月份」，
 *  給「當月預算」這種本質上就是以月為單位的功能用，跟主要的區間篩選是兩回事。 */
export function referenceYearMonth(f: DateFilter): string {
  return `${f.year}-${pad2(f.month)}`;
}

export function dateFilterRange(f: DateFilter): DateRange | null {
  switch (f.mode) {
    case "all":
      return null;
    case "year":
      return { start: `${f.year}-01-01`, end: `${f.year}-12-31` };
    case "month": {
      const lastDay = new Date(f.year, f.month, 0).getDate();
      return { start: `${f.year}-${pad2(f.month)}-01`, end: `${f.year}-${pad2(f.month)}-${pad2(lastDay)}` };
    }
    case "day": {
      const d = `${f.year}-${pad2(f.month)}-${pad2(f.day)}`;
      return { start: d, end: d };
    }
    case "custom":
      return f.customStart <= f.customEnd
        ? { start: f.customStart, end: f.customEnd }
        : { start: f.customEnd, end: f.customStart };
  }
}

export function dateFilterLabel(f: DateFilter): string {
  switch (f.mode) {
    case "all":
      return "全部";
    case "year":
      return `${f.year} 年`;
    case "month":
      return `${f.year} 年 ${f.month} 月`;
    case "day":
      return `${f.year}-${pad2(f.month)}-${pad2(f.day)}`;
    case "custom":
      return `${f.customStart} ～ ${f.customEnd}`;
  }
}

/** vs 上一期的「上一期」是什麼意思，依模式而定：年模式比去年、月模式比上個月、日模式比前一天；
 *  全部／自訂沒有明確的「上一期」，回傳 null（畫面上就不顯示比較）。 */
export function previousDateFilter(f: DateFilter): DateFilter | null {
  switch (f.mode) {
    case "year":
      return { ...f, year: f.year - 1 };
    case "month": {
      const ym = shiftYearMonth(`${f.year}-${pad2(f.month)}`, -1);
      const [y, m] = ym.split("-").map(Number);
      return { ...f, year: y, month: m };
    }
    case "day": {
      const d = new Date(f.year, f.month - 1, f.day - 1);
      return { ...f, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    default:
      return null;
  }
}

/** vs 上一期徽章要用的字——年模式講「vs 去年」、日模式講「vs 前一天」，其餘講「vs 上期」。 */
export function previousPeriodSuffix(mode: DateFilterMode): string {
  if (mode === "year") return "vs 去年";
  if (mode === "day") return "vs 前一天";
  return "vs 上期";
}

function inDateRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}

/** 某個月（YYYY-MM）的曆面範圍，是否跟篩選區間有重疊——薪資紀錄本身只有月份粒度，
 *  用「這個月的 1 號到月底」去跟篩選區間比對重疊，藉此也能套用到日／自訂這種更細的篩選。 */
function yearMonthOverlapsRange(yearMonth: string, range: DateRange | null): boolean {
  if (!range) return true;
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const first = `${yearMonth}-01`;
  const last = `${yearMonth}-${pad2(lastDay)}`;
  return first <= range.end && last >= range.start;
}

export function transactionsInDateRange(range: DateRange | null): Transaction[] {
  return [...transactions].filter((t) => inDateRange(t.date, range)).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function salaryRecordsInDateRange(range: DateRange | null): SalaryRecord[] {
  return salaryRecords.filter((r) => yearMonthOverlapsRange(r.yearMonth, range));
}

export interface RangeTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  expenseTx: Transaction[];
  incomeTx: Transaction[];
  salaryIncome: number;
  extraIncome: number;
}

/** 指定區間的總收入／總支出／結餘。收入＝薪資淨額＋收入類分類的 Transaction（股息、接案、紅包…）；
 *  支出＝支出類分類的 Transaction。兩種分類的 Transaction 共用同一個陣列，用分類的 kind 分流。 */
export function totalsForRange(range: DateRange | null): RangeTotals {
  const rangeTx = transactionsInDateRange(range);
  const expenseTx = rangeTx.filter((t) => categoryById(t.categoryId)?.kind !== "收入");
  const incomeTx = rangeTx.filter((t) => categoryById(t.categoryId)?.kind === "收入");
  const totalExpense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
  const extraIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0);
  const salaryIncome = salaryRecordsInDateRange(range).reduce((sum, r) => sum + salaryNet(r), 0);
  const totalIncome = salaryIncome + extraIncome;
  return { totalIncome, totalExpense, balance: totalIncome - totalExpense, expenseTx, incomeTx, salaryIncome, extraIncome };
}

/** 某個彙總指標「這期 vs 上一期」的差——全部／自訂模式沒有「上一期」就回傳 null；
 *  上一期完全沒有資料（不是 0，是沒資料）也回傳 null，代表沒東西可比。 */
export function rangeDelta(getValue: (range: DateRange | null) => number, filter: DateFilter): MonthDelta | null {
  const prevFilter = previousDateFilter(filter);
  if (!prevFilter) return null;
  const prevRange = dateFilterRange(prevFilter);
  const hasPriorData =
    transactionsInDateRange(prevRange).length > 0 || salaryRecordsInDateRange(prevRange).length > 0;
  if (!hasPriorData) return null;
  const current = getValue(dateFilterRange(filter));
  const previous = getValue(prevRange);
  return { delta: current - previous, pct: previous === 0 ? null : ((current - previous) / previous) * 100 };
}

export interface MonthDelta {
  delta: number;
  pct: number | null; // 上一期是 0 的話百分比沒意義，回傳 null，畫面上只顯示金額差
}

/** 消費分類佔比：子分類的金額算到它的大分類底下，這裡只回傳支出類大分類層級的彙總
 *  （例如「網購」底下的 3C家電／服飾美妝／日用雜貨全部合併顯示成一筆「網購」）。
 *  想看網購內部細節，用 subcategoryBreakdown(range, "c5")。 */
export function categoryBreakdown(range: DateRange | null) {
  const { expenseTx } = totalsForRange(range);
  const byCategory = new Map<string, number>();
  for (const t of expenseTx) {
    const topId = topLevelCategoryId(t.categoryId);
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
  }
  const total = [...byCategory.values()].reduce((a, b) => a + b, 0) || 1;
  return topLevelCategories("支出")
    .map((c) => ({ category: c, amount: byCategory.get(c.id) ?? 0 }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((row) => ({ ...row, pct: Math.round((row.amount / total) * 100) }));
}

/** 收入來源佔比：薪資（兩位成員淨額加總算一筆「薪資」）＋各收入分類，想看整體收入怎麼來的用。 */
export function incomeBreakdown(range: DateRange | null) {
  const { incomeTx, salaryIncome } = totalsForRange(range);
  const byCategory = new Map<string, number>();
  for (const t of incomeTx) {
    const topId = topLevelCategoryId(t.categoryId);
    byCategory.set(topId, (byCategory.get(topId) ?? 0) + t.amount);
  }
  const rows: { id: string; name: string; icon: string; amount: number }[] = [];
  if (salaryIncome > 0) rows.push({ id: "salary", name: "薪資", icon: "💰", amount: salaryIncome });
  for (const c of topLevelCategories("收入")) {
    const amount = byCategory.get(c.id) ?? 0;
    if (amount > 0) rows.push({ id: c.id, name: c.name, icon: c.icon, amount });
  }
  const total = rows.reduce((sum, r) => sum + r.amount, 0) || 1;
  return rows.sort((a, b) => b.amount - a.amount).map((row) => ({ ...row, pct: Math.round((row.amount / total) * 100) }));
}

/** 單一大分類底下，每個子分類在這個區間各花多少——分類管理頁展開「網購」時用。 */
export function subcategoryBreakdown(range: DateRange | null, parentId: string) {
  const { expenseTx } = totalsForRange(range);
  const subs = subCategoriesOf(parentId);
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

// ── 預算 ────────────────────────────────────────────────────────────
// 目前只做「每月一個總預算」，不分分類；之後要分類預算的話，把 value 換成
// Record<categoryId, number> 之類的形狀，budgetForMonth 的呼叫端不用大改。

export const monthlyBudgets: Record<string, number> = {
  "2026-09": 28000,
  "2026-10": 30000,
  "2026-11": 30000,
};

export function budgetForMonth(yearMonth: string): number | undefined {
  return monthlyBudgets[yearMonth];
}

// ── 存錢目標 ────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // YYYY-MM-DD，沒填代表沒有期限
  /** 有值代表是某位成員的個人目標；不填代表全家共同目標。 */
  memberId?: string;
}

export const savingsGoals: SavingsGoal[] = [
  { id: "g1", name: "日本旅遊基金", icon: "✈️", targetAmount: 80000, currentAmount: 32000, targetDate: "2027-03-01" },
  { id: "g2", name: "緊急預備金", icon: "🛟", targetAmount: 150000, currentAmount: 95000 },
  { id: "g3", name: "新手機", icon: "📱", targetAmount: 35000, currentAmount: 35000, memberId: "m2", targetDate: "2026-11-01" },
  { id: "g4", name: "健身房年費", icon: "🏋️", targetAmount: 12000, currentAmount: 4500, memberId: "m1" },
];

export function goalProgress(goal: SavingsGoal) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  return { pct, remaining, achieved: goal.currentAmount >= goal.targetAmount };
}

/** 目前有消費紀錄的最早／最晚月份——匯出頁的月份選擇器預設值用。 */
export function transactionDateRange(): { min: string; max: string } {
  const months = transactions.map((t) => t.date.slice(0, 7)).sort();
  return { min: months[0] ?? "2026-01", max: months[months.length - 1] ?? "2026-01" };
}

/** 起訖月份（含頭尾）之間的消費紀錄，依日期排序——匯出功能用。 */
export function transactionsInRange(startYearMonth: string, endYearMonth: string): Transaction[] {
  return transactions
    .filter((t) => {
      const ym = t.date.slice(0, 7);
      return ym >= startYearMonth && ym <= endYearMonth;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** 格式是 YYYY-MM-DD 還不夠，"2026-13-99" 也會過這個正規表示式——用 Date 轉一圈回來比對，
 *  月份／日期超出範圍時 Date 會自動「進位」到別的日子，跟原始輸入對不上就代表不是真的日期。 */
function isValidISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 消費紀錄轉成 CSV 文字（含標題列）；日期統一用純文字格式，避免 Excel 自動轉成日期序號跑版。 */
export function transactionsToCSV(rows: Transaction[]): string {
  const header = ["日期", "分類", "金額", "備註", "記錄人"];
  const lines = rows.map((t) =>
    [t.date, categoryPath(t.categoryId), t.amount, t.note ?? "", memberName(t.memberId)].map(csvEscape).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

// ── CSV 匯入 ────────────────────────────────────────────────────────

/** 簡單的 CSV 文字解析器，支援雙引號欄位、欄位內的逗號／換行／跳脫雙引號（""）。 */
function parseCSV(text: string): string[][] {
  const s = text.replace(/^﻿/, ""); // 去掉可能的 UTF-8 BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface ImportRowResult {
  row: number; // 第幾列（含標題列，資料從第 2 列開始），給錯誤訊息定位用
  ok: boolean;
  error?: string;
  transaction?: Omit<Transaction, "id">;
}

/** 解析匯入用 CSV：欄位順序比照匯出格式（日期,分類,金額,備註,記錄人）。分類欄接受
 *  「大分類 › 子分類」路徑格式、也接受只填子分類或大分類名稱；每一列都會驗證，格式不對
 *  的列不會擋住其他列，一起回傳讓畫面列出哪幾列有問題、為什麼。 */
export function parseTransactionsCSV(text: string): {
  results: ImportRowResult[];
  validCount: number;
  invalidCount: number;
} {
  const rows = parseCSV(text);
  const dataRows = rows.slice(1); // 跳過標題列
  const results: ImportRowResult[] = dataRows.map((cols, idx) => {
    const rowNum = idx + 2;
    const [date, categoryText, amountText, note, memberText] = cols;

    if (!date || !isValidISODate(date.trim())) {
      return { row: rowNum, ok: false, error: "日期格式不正確，需要 YYYY-MM-DD 且是存在的日期" };
    }
    const amount = Number(amountText);
    if (!amountText || Number.isNaN(amount) || amount <= 0) {
      return { row: rowNum, ok: false, error: "金額不是有效數字" };
    }
    const leafName = (categoryText ?? "").split("›").pop()?.trim() ?? "";
    const category = categories.find((c) => c.name === leafName);
    if (!category) {
      return { row: rowNum, ok: false, error: `找不到分類「${categoryText?.trim() || "（空白）"}」` };
    }
    const member = members.find((m) => m.name === (memberText ?? "").trim());
    if (!member) {
      return { row: rowNum, ok: false, error: `找不到成員「${memberText?.trim() || "（空白）"}」` };
    }
    return {
      row: rowNum,
      ok: true,
      transaction: { categoryId: category.id, memberId: member.id, amount, date: date.trim(), note: note?.trim() || undefined },
    };
  });
  return {
    results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok).length,
  };
}

/** 把驗證通過的匯入資料寫進 transactions。目前還是純前端記憶體版（重新整理頁面會消失），
 *  之後接資料庫時把 push 換成真的新增 API 呼叫即可，回傳形狀不用改。 */
export function commitImportedTransactions(results: ImportRowResult[]): number {
  let count = 0;
  for (const r of results) {
    if (r.ok && r.transaction) {
      transactions.push({ id: `imp-${Date.now()}-${count}`, ...r.transaction });
      count++;
    }
  }
  return count;
}
