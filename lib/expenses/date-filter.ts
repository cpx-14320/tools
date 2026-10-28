// 日期區間篩選（天／週／月／年／全部／自訂）。純邏輯、不碰資料庫，伺服器端（API route）跟
// client component 都能直接 import。原本待在 mock-data.ts 裡，搬過來後內容不變。

// recent3／recent6 是「從基準日往回算三／六個月」的滾動視窗，不是某個曆月或曆年。它們
// 跟其他模式一樣用 year/month/day 當基準日（套預設時就是「今天」），所以 dateFilterRange
// 照樣是純函式、不用在裡面讀時鐘。
export type DateFilterMode = "year" | "month" | "week" | "day" | "recent3" | "recent6" | "all" | "custom";

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

const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 週模式看的是哪一段——以 year/month/day 這個「基準日」所在的那一週，週日起、週六止。
 *
 *  週模式沒有自己的欄位，直接借用日模式的那三個：天跟週切來切去時基準日不會跑掉（今天
 *  看 10/28，切到週就是 10/28 那一週，切回天還是 10/28）。週起始日是週日，跟月曆
 *  （calendar.tsx 的 WEEKDAYS 從「日」開始）一致，不然同一個 App 裡兩種週界線。 */
export function weekRangeOf(year: number, month: number, day: number): DateRange {
  const anchor = new Date(year, month - 1, day);
  const start = new Date(year, month - 1, day - anchor.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: toISO(start), end: toISO(end) };
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
    case "week":
      return weekRangeOf(f.year, f.month, f.day);
    case "day": {
      const d = `${f.year}-${pad2(f.month)}-${pad2(f.day)}`;
      return { start: d, end: d };
    }
    case "recent3":
    case "recent6": {
      // 基準日是區間的「結束」那一端，往回推三／六個月當起點（含頭含尾）。
      const end = `${f.year}-${pad2(f.month)}-${pad2(f.day)}`;
      return { start: shiftMonths(end, f.mode === "recent3" ? -3 : -6), end };
    }
    case "custom":
      return f.customStart <= f.customEnd
        ? { start: f.customStart, end: f.customEnd }
        : { start: f.customEnd, end: f.customStart };
  }
}


export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** vs 上一期的「上一期」是什麼意思，依模式而定：年模式比去年、月模式比上個月、週模式比上週、
 *  天模式比前一天；全部／自訂沒有明確的「上一期」，回傳 null（畫面上就不顯示比較）。 */
export function previousDateFilter(f: DateFilter): DateFilter | null {
  switch (f.mode) {
    case "year":
      return { ...f, year: f.year - 1 };
    case "month": {
      const ym = shiftYearMonth(`${f.year}-${pad2(f.month)}`, -1);
      const [y, m] = ym.split("-").map(Number);
      return { ...f, year: y, month: m };
    }
    case "week":
    case "day": {
      // 週模式往前移七天、天模式往前移一天，兩者都是移同一個基準日（見 weekRangeOf）。
      const d = new Date(f.year, f.month - 1, f.day - (f.mode === "week" ? 7 : 1));
      return { ...f, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    case "recent3":
    case "recent6": {
      // 「上一期」＝再往前整整一個同樣長度的視窗（近三個月的上一期是前面那三個月）。
      const moved = shiftMonths(`${f.year}-${pad2(f.month)}-${pad2(f.day)}`, f.mode === "recent3" ? -3 : -6);
      const [y, m, d] = moved.split("-").map(Number);
      return { ...f, year: y, month: m, day: d };
    }
    default:
      return null;
  }
}

/** vs 上一期徽章要用的字——年模式講「vs 去年」、天模式講「vs 前一天」，其餘講「vs 上期」。 */
export function previousPeriodSuffix(mode: DateFilterMode): string {
  if (mode === "year") return "vs 去年";
  if (mode === "week") return "vs 上週";
  if (mode === "day") return "vs 前一天";
  if (mode === "recent3") return "vs 前 3 個月";
  if (mode === "recent6") return "vs 前 6 個月";
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

/** 預設不比較。換日期範圍只是換「看哪一段」，不該順便冒出一排 ▲／▼ 的漲跌徽章——
 *  要跟別期比是另一個決定，使用者自己按標題旁邊那顆「不比較 ▾」挑了才開始比。 */
export function defaultCompareSetting(): CompareSetting {
  return { mode: "none", year: new Date().getFullYear() - 1 };
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

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 把 `YYYY-MM-DD` 往前／往後推幾天。用本地時區的 Date 做日曆運算，不碰 UTC
 *  （理由見 lib/format.ts 的 weekdayLabel）。 */
export function shiftDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + delta));
}

/** 把 `YYYY-MM-DD` 往前／往後推幾個月，日期超過目標月份的天數時夾到月底。
 *
 *  直接丟 `new Date(y, m - 1 + delta, d)` 的話「3/31 往前一個月」會溢位變成 3/3
 *  （2 月沒有 31 日），拿來當「近一個月」的起點時窗口會莫名縮短好幾天。 */
export function shiftMonths(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return isoOf(target);
}

/** 依日期把清單分組，保留傳進來的順序（呼叫端先排好新的在前面，分出來的組就是新的在
 *  前面）。首頁的最近消費、資產總表的轉帳明細都是「日期小標＋那天幾筆」的版面，本來
 *  各自在元件裡寫一次同樣的 reduce。 */
export function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
  return [...map];
}

// ────────────────────────────────────────────────────────────────────────────
// 期間預設
// 選期間時真正想說的是「本月」「上月」「近 3 個月」這種一句話講完的事，不是「先挑單位
// 月、再用箭頭往前翻一格」兩個步驟。所以彈窗列的是這一排預設，底下仍然對應到上面那幾個
// mode（本月→month、上週→week＋基準日往前七天…），翻頁的 ‹ › 跟「跟誰比」的邏輯完全
// 不用改。
// ────────────────────────────────────────────────────────────────────────────

export type DateFilterPreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "recent3"
  | "recent6"
  | "thisYear"
  | "lastYear"
  | "all"
  | "custom";

/** 彈窗裡那一排預設，順序從短到長，最後才是「全部」跟「自訂範圍」。 */
export const DATE_FILTER_PRESETS: { key: DateFilterPreset; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "thisWeek", label: "本週" },
  { key: "lastWeek", label: "上週" },
  { key: "thisMonth", label: "本月" },
  { key: "lastMonth", label: "上月" },
  { key: "recent3", label: "近 3 個月" },
  { key: "recent6", label: "近 6 個月" },
  { key: "thisYear", label: "今年" },
  { key: "lastYear", label: "去年" },
  { key: "all", label: "全部" },
  { key: "custom", label: "自訂範圍" },
];

/** 把一個預設套到現有的篩選器上。
 *
 *  `today` 由呼叫端傳進來（元件掛載時用 useState 固定住一次）——這個函式不自己讀時鐘，
 *  不然同一個 render 在伺服器端跟瀏覽器端會算出不同的結果，hydration 會對不起來。
 *  自訂範圍只負責切到 custom 模式，起訖日期維持原本的值交給區間選擇器去改。 */
export function applyDateFilterPreset(f: DateFilter, preset: DateFilterPreset, today: string): DateFilter {
  const at = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day };
  };
  const thisYear = Number(today.slice(0, 4));
  switch (preset) {
    case "today":
      return { ...f, mode: "day", ...at(today) };
    case "yesterday":
      return { ...f, mode: "day", ...at(shiftDays(today, -1)) };
    case "thisWeek":
      return { ...f, mode: "week", ...at(today) };
    case "lastWeek":
      return { ...f, mode: "week", ...at(shiftDays(today, -7)) };
    case "thisMonth":
      return { ...f, mode: "month", ...at(today) };
    case "lastMonth": {
      // 從「這個月 1 號」往前推一個月，不是從今天——今天是 31 號的話直接推月份會溢位
      // （見 shiftMonths 的說明）。月模式只看 year/month，基準日就留著原本的。
      const prev = at(shiftMonths(`${today.slice(0, 7)}-01`, -1));
      return { ...f, mode: "month", year: prev.year, month: prev.month };
    }
    case "recent3":
      return { ...f, mode: "recent3", ...at(today) };
    case "recent6":
      return { ...f, mode: "recent6", ...at(today) };
    case "thisYear":
      return { ...f, mode: "year", year: thisYear };
    case "lastYear":
      return { ...f, mode: "year", year: thisYear - 1 };
    case "all":
      return { ...f, mode: "all" };
    case "custom":
      return { ...f, mode: "custom" };
  }
}

/** 目前的篩選器對應到哪一個預設（彈窗要標「使用中」）——用 ‹ › 翻到任意一個月／一年之後
 *  就不對應任何預設了，回傳 null，那時候彈窗裡一列都不標，這是誠實的：畫面上看的既不是
 *  本月也不是上月。比對的是算出來的區間而不是欄位，週這種「同一個模式、不同基準日」才
 *  分得出本週跟上週。 */
export function dateFilterPresetOf(f: DateFilter, today: string): DateFilterPreset | null {
  if (f.mode === "custom") return "custom";
  for (const { key } of DATE_FILTER_PRESETS) {
    if (key === "custom") continue;
    const candidate = applyDateFilterPreset(f, key, today);
    if (candidate.mode !== f.mode) continue;
    const a = dateFilterRange(candidate);
    const b = dateFilterRange(f);
    if (a === null && b === null) return key;
    if (a && b && a.start === b.start && a.end === b.end) return key;
  }
  return null;
}

/** 依日期分組的清單，跨組往下數到第 limit 筆為止（數滿了的那一組只留前面幾筆，後面的
 *  組整組捨去）。收合長清單用——照「天數」切的話，同一天記了五六筆時收合後還是一長串。 */
export function limitDateGroups<T>(groups: [string, T[]][], limit: number): [string, T[]][] {
  const out: [string, T[]][] = [];
  let left = limit;
  for (const [date, items] of groups) {
    if (left <= 0) break;
    out.push([date, items.slice(0, left)]);
    left -= items.length;
  }
  return out;
}
