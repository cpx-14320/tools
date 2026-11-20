// 行情清單的組裝、搜尋、篩選與排序。純函式、client 也能用——**但價格不是在這裡算的**，
// 是伺服器端從開放資料整理好（lib/freshwise/prices.server.ts）之後當 props 傳下來的。
//
// 這裡刻意把「品項 ＋ 今日行情 ＋ 漲跌 ＋ 划算度 ＋ 當季」綁成一個 PriceRow 再交給畫面，
// 而不是讓清單元件自己對每一列各算一次。理由是這幾件事在首頁、行情頁、我的菜籃、詳情頁
// 都會一起出現，分開算的話同一套判定邏輯會散在四個檔案裡，門檻一改就會有地方漏改。

import { itemOrPlaceholder, TRACKED_CATALOG } from "./catalog";
import { isInSeason } from "./catalog";
import { monthOf } from "./dates";
import { hasReliableHistory, trendOf, valueOf, type Trend, type ValueJudgement } from "./price";
import type { CatalogItem, CategoryKey, PriceQuote } from "./types";

export interface PriceRow {
  item: CatalogItem;
  quote: PriceQuote;
  trend: Trend;
  value: ValueJudgement;
  /** 這個月份是不是這個品項的當季。 */
  inSeason: boolean;
  /** 歷史夠不夠長，可以講划算度（見 price.ts 的 MIN_HISTORY_DAYS）。不夠的話畫面上
   *  不顯示划算徽章與一年區間，改說「歷史資料累積中」。 */
  reliable: boolean;
}

export function toRow(item: CatalogItem, quote: PriceQuote, month: number): PriceRow {
  return {
    item,
    quote,
    trend: trendOf(quote),
    value: valueOf(quote),
    inSeason: isInSeason(item, month),
    reliable: hasReliableHistory(quote),
  };
}

/**
 * 把伺服器送下來的價格簿攤成清單列。
 *
 * 價格簿裡沒有的品項不會出現——那代表這個品項今天在這個場所完全沒有行情（產季外的水果
 * 整段沒有交易、或這個市場今天沒進這樣貨）。不要補一列「查無資料」：使用者要的是「今天
 * 可以買什麼」，一排查無資料只是雜訊。
 */
export function rowsFromBook(quotes: Record<string, PriceQuote>, dateISO: string, codes?: string[]): PriceRow[] {
  const month = monthOf(dateISO);
  const list = codes ? codes.map((code) => itemOrPlaceholder(code)) : TRACKED_CATALOG;
  const rows: PriceRow[] = [];
  for (const item of list) {
    const quote = quotes[item.code];
    if (quote) rows.push(toRow(item, quote, month));
  }
  return rows;
}

/* ───────────────────── 搜尋 ───────────────────── */

/** 比對關鍵字。名稱與別名都算命中——使用者會打「高麗菜」，但農業部的正式名稱是「甘藍」，
 *  只比對正式名稱的話最常買的那顆菜反而搜不到。英文大小寫一起正規化（進口水果會用到）。 */
export function matchesKeyword(item: CatalogItem, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  if (item.name.toLowerCase().includes(kw)) return true;
  return item.aliases.some((alias) => alias.toLowerCase().includes(kw));
}

export interface RowFilter {
  /** 空字串＝全部分類。 */
  category?: CategoryKey | "";
  keyword?: string;
  /** 只看當季。 */
  inSeasonOnly?: boolean;
  /** 只看划算的（跟近一年均價比便宜 10% 以上，而且歷史夠長）。 */
  cheapOnly?: boolean;
  /** 只看有實際訪價的（不含推估值）。 */
  measuredOnly?: boolean;
}

export function filterRows(rows: PriceRow[], filter: RowFilter): PriceRow[] {
  return rows.filter((row) => {
    if (filter.category && row.item.category !== filter.category) return false;
    if (filter.keyword && !matchesKeyword(row.item, filter.keyword)) return false;
    if (filter.inSeasonOnly && !row.inSeason) return false;
    if (filter.cheapOnly && !(row.reliable && row.value.level === "cheap")) return false;
    if (filter.measuredOnly && row.quote.estimated) return false;
    return true;
  });
}

/* ───────────────────── 排序 ───────────────────── */

export type SortKey = "recommended" | "cheapest" | "priceAsc" | "priceDesc" | "drop" | "rise";

export const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = [
  { key: "recommended", label: "推薦" },
  { key: "cheapest", label: "最划算" },
  { key: "drop", label: "跌最多" },
  { key: "rise", label: "漲最多" },
  { key: "priceAsc", label: "價格低→高" },
  { key: "priceDesc", label: "價格高→低" },
];

/** 划算度排序用的分數。歷史不夠長的品項不該參加「最划算」的排名（它的「平常價」只是
 *  幾天的平均），一律排到後面去。 */
function valueScore(row: PriceRow): number {
  return row.reliable ? row.value.percent : 999;
}

/**
 * 排序。`recommended`（預設）是「當季 → 划算 → 跌幅」三層：這個工具的使用者不知道該買
 * 什麼，預設清單應該先給他當季又便宜的東西，不是按價格高低列一排看不出重點的數字。
 *
 * 一律回傳新陣列（不原地改），呼叫端常常在 useMemo 裡連著篩選一起算，原地改會把上一層
 * 的資料也改掉。
 */
export function sortRows(rows: PriceRow[], sort: SortKey): PriceRow[] {
  const sorted = [...rows];
  switch (sort) {
    case "cheapest":
      sorted.sort((a, b) => valueScore(a) - valueScore(b));
      break;
    case "priceAsc":
      sorted.sort((a, b) => a.quote.avgKg - b.quote.avgKg);
      break;
    case "priceDesc":
      sorted.sort((a, b) => b.quote.avgKg - a.quote.avgKg);
      break;
    case "drop":
      sorted.sort((a, b) => a.trend.percent - b.trend.percent);
      break;
    case "rise":
      sorted.sort((a, b) => b.trend.percent - a.trend.percent);
      break;
    case "recommended":
    default:
      sorted.sort((a, b) => {
        if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1;
        const byValue = valueScore(a) - valueScore(b);
        if (byValue !== 0) return byValue;
        return a.trend.percent - b.trend.percent;
      });
      break;
  }
  return sorted;
}
