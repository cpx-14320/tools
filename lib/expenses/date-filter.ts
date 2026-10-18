// 日期區間篩選（年／月／日／全部／自訂）。純邏輯、不碰資料庫，伺服器端（API route）跟
// client component 都能直接 import。原本待在 mock-data.ts 裡，搬過來後內容不變。

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
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return {
    mode: "month",
    year: y,
    month: m,
    day: now.getDate(),
    customStart: `${y}-${pad2(m)}-01`,
    customEnd: `${y}-${pad2(m)}-${pad2(lastDay)}`,
  };
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

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
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

// ────────────────────────────────────────────────────────────────────────────
// 比較基準
// 「跟什麼比」跟「看哪一段」是兩件獨立的事：看的區間由上面的 DateFilter 決定，要拿它
// 跟誰比則由這裡的 CompareMode 決定。這樣才問得出「今年十月 vs 去年十月」這種同期比較
// ——原本固定比上一期的話，十月永遠只能跟九月比，而九月跟十月的消費本來就不同性質
// （中秋、雙十），比起來沒什麼意義。
//
// 基準一律是「把現在看的這段期間整個平移到另一個年份／往前一期」，不是自己另外選一段
// 任意區間：平移才保證兩邊的天數、落在一年裡的位置是對齊的，比出來的數字才可比。
// ────────────────────────────────────────────────────────────────────────────

export type CompareMode = "previous" | "lastYear" | "year" | "none";

export interface CompareSetting {
  mode: CompareMode;
  /** mode === "year" 時要比的那個年份（例如 2024）。 */
  year: number;
}

export function defaultCompareSetting(): CompareSetting {
  return { mode: "previous", year: new Date().getFullYear() - 1 };
}

function shiftFilterToYear(f: DateFilter, year: number): DateFilter | null {
  if (f.mode === "all") return null;
  const delta = year - f.year;
  if (delta === 0) return null;
  if (f.mode === "custom") {
    const shift = (d: string) => {
      const [y, m, day] = d.split("-").map(Number);
      return `${y + delta}-${pad2(m)}-${pad2(day)}`;
    };
    return { ...f, year, customStart: shift(f.customStart), customEnd: shift(f.customEnd) };
  }
  return { ...f, year };
}

/** 依照比較設定算出「要拿來比的那一段」——回傳 null 代表這個組合沒有可比的區間
 *  （例如選了不比較、或「全部」模式下沒有同期的概念），畫面上就不顯示漲跌。 */
export function compareDateFilter(f: DateFilter, setting: CompareSetting): DateFilter | null {
  switch (setting.mode) {
    case "none":
      return null;
    case "previous":
      return previousDateFilter(f);
    case "lastYear":
      return shiftFilterToYear(f, f.year - 1);
    case "year":
      return shiftFilterToYear(f, setting.year);
  }
}

/** 漲跌幅旁邊那行小字要寫什麼——使用者要一眼知道現在比的是誰，不然 ▲12% 沒有意義。 */
export function compareLabel(f: DateFilter, setting: CompareSetting): string {
  switch (setting.mode) {
    case "none":
      return "";
    case "previous":
      return previousPeriodSuffix(f.mode);
    case "lastYear":
      return "vs 去年同期";
    case "year":
      return `vs ${setting.year} 年同期`;
  }
}

export function inDateRange(date: string, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}
