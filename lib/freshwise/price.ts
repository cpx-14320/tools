// 價格的單位換算、格式化、漲跌與「划算度」判定。純函式，沒有任何 I/O，所以
// scripts/freshwise-feature-check.mts 可以直接呼叫來驗證。
//
// 一條鐵則：**資料層一律存元/公斤，台斤只存在於顯示層。** 農業部的批發行情是元/公斤、
// 台灣的零售訪價是元/台斤，兩種單位混在同一個欄位裡遲早會有人拿 1.8 倍的數字去跟 1
// 倍的比，而且錯得很安靜（數字看起來都很合理）。所以 PriceQuote 裡每個欄位都叫 *Kg，
// 要顯示的時候才呼叫這裡的 toUnit。

import type { PricePoint, PriceQuote, TrendDirection, UnitKey, ValueLevel } from "./types";

/** 1 台斤 = 0.6 公斤（台灣的台斤，不是日本的斤）。 */
export const KG_PER_CATTY = 0.6;

/* ───────────────────── 單位換算與格式化 ───────────────────── */

/** 一個單位等於幾公斤。資料層一律是元/公斤，換算就只是乘這個係數。 */
const KG_PER_UNIT: Record<UnitKey, number> = { catty: KG_PER_CATTY, kg: 1 };

/** 元/公斤 → 指定單位的價格。 */
export function toUnit(priceKg: number, unit: UnitKey): number {
  return priceKg * KG_PER_UNIT[unit];
}

/** 指定單位的價格 → 元/公斤。使用者自己輸入價格（之後的「回報價格」功能）時要用。 */
export function fromUnit(price: number, unit: UnitKey): number {
  return price / KG_PER_UNIT[unit];
}

const UNIT_SHORT: Record<UnitKey, string> = { catty: "台斤", kg: "公斤" };

/**
 * 份量換算。**方向跟價格相反**，分成兩支函式就是為了不要再弄錯：
 *
 *   價格：元/公斤 → 元/台斤 是 **乘** 0.6（一台斤比較少，所以比較便宜）
 *   份量：0.6 公斤 → 台斤   是 **除** 0.6（同樣的量，換個單位數字變大）
 *
 * 用 toUnit 去換份量會得到 0.36 台斤這種數字，而且看起來很像合理的小數，不會噴錯。
 */
export function qtyInUnit(kg: number, unit: UnitKey): number {
  return kg / KG_PER_UNIT[unit];
}

export function qtyToKg(qty: number, unit: UnitKey): number {
  return qty * KG_PER_UNIT[unit];
}


export function unitLabel(unit: UnitKey): string {
  return `元/${UNIT_SHORT[unit]}`;
}

/** 單位的短名稱，接在數量後面（「2 台斤」）。 */
export function unitShort(unit: UnitKey): string {
  return UNIT_SHORT[unit];
}

/**
 * 價格的顯示字串。10 元以上取整數、10 元以下留一位小數——買菜的場景不會有人在意
 * 48 塊還是 48.3 塊，但便宜的葉菜如果一律取整，8.4 跟 8.6 會變成同一個數字，漲跌徽章
 * 說漲了 3% 而上面兩個數字一模一樣，看起來像壞掉。
 *
 * 判斷「有沒有到 10 元」是用**四捨五入到一位小數之後**的值，不是原始值：9.96 元直接套
 * 一位小數會印成「10.0」，擺在旁邊那些整數（18、21）中間看起來像另一種格式。先捨入再
 * 判斷，9.96 就會跟著走整數那條路印成「10」。
 */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  const rounded = Math.round(price * 10) / 10;
  return rounded >= 10 ? String(Math.round(price)) : rounded.toFixed(1);
}

/** 直接把元/公斤的價格換算成指定單位再格式化，呼叫端最常用的就是這一支。 */
export function formatPriceIn(priceKg: number, unit: UnitKey): string {
  return formatPrice(toUnit(priceKg, unit));
}

/* ───────────────────── 漲跌 ───────────────────── */

/** 漲跌幅在這個百分比以內一律當持平。價格本來就會有一兩塊的雜訊，不設死區的話畫面上
 *  會滿滿都是「漲 0.4%」這種沒有意義的紅色徽章，真正該被注意的暴漲反而被淹沒。 */
export const FLAT_THRESHOLD_PERCENT = 1.5;

export interface Trend {
  direction: TrendDirection;
  /** 相對前一個交易日的變化百分比（漲是正、跌是負，已四捨五入到整數）。 */
  percent: number;
  /** 元/公斤的差額（漲是正、跌是負）。 */
  diffKg: number;
}

export function trendOf(quote: Pick<PriceQuote, "avgKg" | "prevKg">): Trend {
  const prev = quote.prevKg;
  if (!prev || prev <= 0) return { direction: "flat", percent: 0, diffKg: 0 };

  const diffKg = Math.round((quote.avgKg - prev) * 10) / 10;
  const percent = Math.round(((quote.avgKg - prev) / prev) * 100);
  const direction: TrendDirection =
    Math.abs(percent) < FLAT_THRESHOLD_PERCENT ? "flat" : percent > 0 ? "up" : "down";
  return { direction, percent, diffKg };
}

/** 漲跌徽章上的文字（「▲ 12%」「▼ 8%」「持平」）。符號用三角形不用箭頭，跟股票看盤
 *  的習慣一致，一眼就懂。 */
export function trendLabel(trend: Trend): string {
  if (trend.direction === "flat") return "持平";
  return `${trend.direction === "up" ? "▲" : "▼"} ${Math.abs(trend.percent)}%`;
}

/* ───────────────────── 划算度 ───────────────────── */

/** 跟近一年均價差多少才算便宜／貴。±10% 是刻意設寬的：菜價一年的區間本來就很大，
 *  門檻太窄的話每天都會有半數品項被標成「划算」，標籤就不值錢了。 */
export const VALUE_THRESHOLD_PERCENT = 10;

/**
 * 要累積幾天的歷史，才敢說「比近一年平均便宜 X%」。
 *
 * 這條不是潔癖，是誠實：批發行情的歷史是從接上資料那天開始一天一天累積的（農業部那支
 * 不可能在一次頁面算繪裡查完一年），只有三天資料就拿「這三天的平均」當「平常的價格」，
 * 然後告訴使用者「今天很划算」，那是在編造結論。天數不夠時畫面上不顯示划算度與一年
 * 區間，改說「歷史資料累積中」。
 *
 * 零售（臺中那份）一抓就有滾動一年，所以預設場所一開始就過得了這個門檻。
 */
export const MIN_HISTORY_DAYS = 30;

/** 這筆報價的歷史夠不夠長，可以講划算度。 */
export function hasReliableHistory(quote: { historyDays: number }): boolean {
  return quote.historyDays >= MIN_HISTORY_DAYS;
}

/** 累積到幾天才敢把比較基準講成「近一年」。 */
const YEAR_ISH_DAYS = 300;

/**
 * 比較基準的說法。
 *
 * 不要一律寫「比近一年平均」——批發行情的歷史是一天一天累積的，接上資料的第一個月
 * 實際上只有三十幾天。拿三十幾天的平均去說「近一年平均」，數字沒錯但話說錯了，而且錯
 * 的方向剛好會誇大划算程度（三個月的區間比一年窄，百分比看起來更誇張）。
 */
export function historyLabel(historyDays: number): string {
  return historyDays >= YEAR_ISH_DAYS ? "近一年" : `過去 ${historyDays} 天`;
}

export interface ValueJudgement {
  level: ValueLevel;
  /** 相對近一年均價的百分比（便宜是負、貴是正）。 */
  percent: number;
  /** 今天的價格落在近一年「最低～最高」區間的哪個位置（0＝今年最便宜、1＝今年最貴）。
   *  詳情頁用這個畫一條區間指示條。 */
  position: number;
}

export function valueOf(quote: Pick<PriceQuote, "avgKg" | "yearAvgKg" | "yearLowKg" | "yearHighKg">): ValueJudgement {
  const { avgKg, yearAvgKg, yearLowKg, yearHighKg } = quote;
  const percent = yearAvgKg > 0 ? Math.round(((avgKg - yearAvgKg) / yearAvgKg) * 100) : 0;
  const level: ValueLevel =
    percent <= -VALUE_THRESHOLD_PERCENT ? "cheap" : percent >= VALUE_THRESHOLD_PERCENT ? "pricey" : "fair";

  const span = yearHighKg - yearLowKg;
  // 區間寬度是 0（一年都沒變過，理論上只有資料異常才會這樣）時固定放中間，不要除以 0。
  const position = span > 0 ? Math.min(1, Math.max(0, (avgKg - yearLowKg) / span)) : 0.5;

  return { level, percent, position };
}

/** 划算度的完整說明句，給詳情頁用（首頁的徽章只放上面那兩三個字）。
 *  `historyDays` 決定比較基準怎麼講（見 historyLabel）。 */
export function valueSentence(judgement: ValueJudgement, historyDays: number): string {
  const abs = Math.abs(judgement.percent);
  const base = historyLabel(historyDays);
  if (judgement.level === "cheap") return `比${base}的平均便宜 ${abs}%，現在買划算。`;
  if (judgement.level === "pricey") return `比${base}的平均貴 ${abs}%，可以考慮晚一點再買。`;
  return `跟${base}的平均差不多，是正常價。`;
}

/* ───────────────────── 走勢統計 ───────────────────── */

export interface SeriesStats {
  minKg: number;
  maxKg: number;
  avgKg: number;
  /** 第一個點到最後一個點的變化百分比，給「近 30 天漲了 12%」這種句子用。 */
  changePercent: number;
  count: number;
}

export function statsOf(points: PricePoint[]): SeriesStats {
  if (points.length === 0) return { minKg: 0, maxKg: 0, avgKg: 0, changePercent: 0, count: 0 };
  const values = points.map((p) => p.avgKg);
  const first = values[0];
  const last = values[values.length - 1];
  return {
    minKg: Math.min(...values),
    maxKg: Math.max(...values),
    avgKg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    changePercent: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
    count: values.length,
  };
}

/* ───────────────────── 菜籃金額估算 ───────────────────── */

/** 一筆菜籃項目的估算金額（元）。數量是台斤，價格是元/公斤，所以要先換算。
 *  沒填數量的項目回 null——不要自己假設「大概一斤吧」然後把它算進總額，那會讓總額
 *  看起來是精算過的，其實是猜的。 */
export function entryCost(qtyCatty: number | null, priceKg: number): number | null {
  if (qtyCatty === null || qtyCatty <= 0 || priceKg <= 0) return null;
  return Math.round(qtyCatty * KG_PER_CATTY * priceKg);
}

export interface BasketCost {
  /** 有填數量的項目的金額合計。 */
  total: number;
  /** 有算進總額的項目數。 */
  counted: number;
  /** 沒填數量、沒算進總額的項目數。畫面上要講清楚「另外 N 項沒填數量」。 */
  skipped: number;
}

export function basketCost(entries: { qtyCatty: number | null; priceKg: number }[]): BasketCost {
  let total = 0;
  let counted = 0;
  let skipped = 0;
  for (const entry of entries) {
    const cost = entryCost(entry.qtyCatty, entry.priceKg);
    if (cost === null) skipped++;
    else {
      total += cost;
      counted++;
    }
  }
  return { total, counted, skipped };
}

/** 金額加上千分位（「1,280」）。 */
export function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString("en-US");
}
