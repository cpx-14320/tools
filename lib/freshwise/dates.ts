// 日期工具。整個 FreshWise 一律用 `YYYY-MM-DD` 字串當日期的流通格式，不傳 Date 物件。
//
// 為什麼不用 Date 物件在模組之間傳：這個工具的頁面是 Server Component 先算好資料再把
// props 傳給 client 元件（跟記帳本同一套做法），Date 物件跨 server／client 邊界會被序
// 列化成字串又再被解析回來，時區一不小心就差一天；而且假價格是用「日期」當亂數種子生
// 成的，server 跟 client 只要對同一天算出不同的種子，hydration 就會對不起來。字串沒有
// 這個問題。
//
// 所有計算都走 UTC（`Date.UTC`、`getUTC*`）。只用來「把 YYYY-MM-DD 加減幾天」的話，
// UTC 不會踩到本地時區換日、日光節約的坑；真正要知道「使用者的今天」時由最外層的
// Server Component 算一次再往下傳（見 app/tools/freshwise/page.tsx 的 todayISO）。

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 把 YYYY-MM-DD 轉成 UTC 的毫秒數。格式不對會丟例外——這種錯一定是程式寫錯，
 *  靜靜地回 NaN 只會讓錯誤跑到很後面才炸、更難找。 */
export function parseISO(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`日期格式必須是 YYYY-MM-DD，收到的是「${iso}」`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toISO(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return toISO(parseISO(iso) + days * MS_PER_DAY);
}

/** 兩個日期相差幾天（後面減前面，可以是負數）。 */
export function diffDays(fromISO: string, toISODate: string): number {
  return Math.round((parseISO(toISODate) - parseISO(fromISO)) / MS_PER_DAY);
}

/** 1970-01-01 起算的天數。假價格的亂數種子要用到，所以需要一個穩定的整數日期序號。 */
export function dayIndex(iso: string): number {
  return Math.round(parseISO(iso) / MS_PER_DAY);
}

/** 月份（1–12）。當季判定用。 */
export function monthOf(iso: string): number {
  return new Date(parseISO(iso)).getUTCMonth() + 1;
}

/** 星期（0＝週日，6＝週六）。批發市場週一休市要用。 */
export function weekdayOf(iso: string): number {
  return new Date(parseISO(iso)).getUTCDay();
}

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 「2026-11-20（四）」——畫面上顯示日期**一律用這一個**。
 *
 * 本來是「11/20（四）」。省略年份在「今天的行情」那種情境看起來沒問題，但這個工具會
 * 顯示歷史資料日期與走勢區間，跨年之後「1/3」到底是哪一年要使用者自己猜。格式跟資料
 * 本身的流通格式（YYYY-MM-DD）一致，也省得兩種寫法在同一頁並存。
 */
export function formatShortDate(iso: string): string {
  const d = new Date(parseISO(iso));
  return `${iso}（${WEEKDAY_NAMES[d.getUTCDay()]}）`;
}

/** 「11/20」——**只給圖表座標軸**用。那兩個端點標籤各只有十幾 px 的寬度，放完整日期
 *  會疊在一起；軸上的點本來就在同一段區間內，不會有跨年看不懂的問題。 */
export function formatMonthDay(iso: string): string {
  const d = new Date(parseISO(iso));
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * 轉成民國日期字串。農業部的交易行情 API 用的是民國年：農產品是 `115.11.20`、漁產品
 * 是 `1151120`（同一個平台兩種格式，實測過的，不是筆誤）。真資料接上後查詢參數要用
 * 這兩種格式之一，所以這個轉換先放在這裡，順便讓「資料日期」能用台灣人習慣的寫法顯示。
 */
export function toROC(iso: string, separator: "." | "" = "."): string {
  const d = new Date(parseISO(iso));
  const year = d.getUTCFullYear() - 1911;
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return [String(year), m, day].join(separator);
}

/**
 * 「今天」——**以台灣時間（UTC+8）為準**，不是伺服器所在時區、也不是 UTC。
 *
 * 這一條踩過：原本直接用 UTC 日界算，結果台灣時間凌晨 0 點到 8 點之間，整個工具顯示的
 * 是「昨天」的日期與行情（UTC 那時候還在前一天）。正式環境跑在 Vercel，伺服器時區就是
 * UTC，所以這不是只有開發機才會遇到的問題——每天凌晨都會發生。
 *
 * 用 Intl 指定 `Asia/Taipei` 而不是自己加 8 小時：寫死的偏移量看起來簡單，但「台灣時間」
 * 這件事該由時區資料庫回答，不是由一個常數回答。`en-CA` 的日期格式剛好就是 YYYY-MM-DD。
 *
 * 只給腳本與 Server Component 用；畫面上的「今天」一律由 Server Component 算一次再往下
 * 傳，client 元件不要自己叫這支，不然伺服器與瀏覽器各算一次、跨午夜時會對不起來。
 */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}
