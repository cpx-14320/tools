// 假價格產生器。
//
// **這不再是畫面的資料來源。** 畫面上的行情已經接上真實的開放資料（農業部的農產品／
// 漁產品／家禽交易行情，以及臺中市公有零售市場的每日訪價），由 lib/freshwise/
// prices.server.ts 整理後在伺服器端算好傳給畫面。
//
// 這個檔案留下來有兩個用途：
//   1. **測試**：scripts/freshwise-feature-check.mts 要驗證搜尋、排序、划算度判定、菜籃
//      金額這些純邏輯，用可重現的假資料比連真的 API 穩定得多（真資料每天都在變，測試
//      會莫名失敗；而且不該讓跑一次測試就打一輪外部 API）。
//   2. **參考**：它示範了 PriceQuote 的每個欄位該長什麼樣。
//
// 為什麼不是寫一包固定的 JSON 假資料：這個工具的主要畫面是「今天的價格」與「近一年的
// 走勢」，固定假資料會讓今天永遠是同一天、走勢圖永遠是同一條線，根本看不出版面在真實
// 資料下會長怎樣（也測不到休市、缺資料、暴漲這些狀態）。所以這裡用「可重現的亂數」：
// 同一個（品項、場所、市場、日期）永遠算出同一個價格，但不同日期之間會有像真的一樣的
// 緩慢起伏。
//
// **可重現這件事是硬要求，不是為了優雅。** 頁面是 Server Component 先算好資料、再把
// props 傳給 client 元件；如果 server 跟 client 對同一天算出不同數字，React hydration
// 會直接報錯。所以這裡完全不碰 Math.random()、不碰 new Date()，每個數字都是從字串
// 雜湊出來的。
//
// 真資料接上後，要換掉的只有這個檔案裡的三支匯出函式（buildQuote／buildSeries／
// marketQuotesOf），price.ts、search.ts、advice.ts 與所有畫面都不用動。

import { findItem, isInSeason, marketsOfVenue, VENUE_MULTIPLIER } from "./catalog";
import { addDays, dayIndex, monthOf, weekdayOf } from "./dates";
import type { MarketQuote, PricePoint, PriceQuote, VenueKey } from "./types";

/* ───────────────────── 可重現的亂數 ───────────────────── */

/**
 * 字串雜湊：FNV-1a ＋ 一道最終混合（MurmurHash3 的 fmix32）。
 *
 * **那道最終混合不是裝飾，少了它這個檔案就不會動。** 這裡的用法是「把 key:節點編號
 * 雜湊成一個隨機數」，而節點編號是連續的整數（…692、693、694…）。單純的 FNV-1a 對
 * 「只差最後一兩個字元」的輸入雪崩效應很差——實測連續節點算出來的值是 0.7167、0.7128、
 * 0.7089、0.7050，等差數列一樣規律。拿這種值當雜訊節點，插出來的曲線幾乎是一條水平線
 * （實際症狀：一個月的菜價只有五個不同的數字，走勢圖是平的）。
 *
 * fmix32 把低位的差異擴散到整個 32 位元，連續輸入才會得到真正散開的值。Math.imul 是
 * 32 位元整數乘法，普通的 `*` 會因為超過 2^53 而掉精度。
 */
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  }
  // 最終混合（avalanche）。
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 把雜湊值壓到 0～1。 */
function unit(input: string): number {
  return hash32(input) / 0xffffffff;
}

/** 平滑插值用的 S 曲線。直接線性插值的話，折線圖在每個節點都會出現一個明顯的尖角，
 *  看起來像資料有問題；smoothstep 讓曲線在節點處斜率為 0，整條線是圓滑的。 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * 值噪聲（value noise）：給定一個 key 與一條時間軸上的位置，回傳 -1～1 之間、**隨時間
 * 緩慢變化**的數字。`period` 是「幾天換一個節點」——period 大就是慢波（月級的產季行情），
 * period 小就是快波（週級的天氣與到貨量波動）。
 *
 * 不用 Math.sin 疊幾個頻率，是因為那樣每個品項的曲線形狀會長得一模一樣，只差相位；
 * 值噪聲每個節點都是獨立的隨機數，不同品項的線條形狀真的不一樣。
 */
function valueNoise(key: string, day: number, period: number): number {
  const node = Math.floor(day / period);
  const t = smoothstep((day - node * period) / period);
  const a = unit(`${key}:${node}`);
  const b = unit(`${key}:${node + 1}`);
  return (a + (b - a) * t) * 2 - 1;
}

/* ───────────────────── 各類別的波動幅度 ───────────────────── */

/**
 * 不同類別的價格波動幅度差很多，用同一組參數生成的話，豬肉會跟青蔥一樣一天漲三成，
 * 畫面上的漲跌徽章就失去意義了。這裡的數字是「波動的放大倍率」：
 *   - 蔬菜最敏感：一場大雨、一個颱風就能讓葉菜翻倍。
 *   - 水果次之：有產季，但不會天天跳。
 *   - 漁產看漁獲與天氣，中等。
 *   - 肉類與蛋走的是產銷會議與飼料成本，以「週」為單位緩慢移動，日間幾乎不動。
 */
const VOLATILITY: Record<string, number> = {
  veg: 1,
  fruit: 0.7,
  seafood: 0.55,
  meat: 0.22,
  egg: 0.15,
};

/* ───────────────────── 休市 ───────────────────── */

/**
 * 批發市場週一休市（農產品批發市場的慣例，開放資料裡那一天就是整天沒有任何一列）。
 * 傳統市場與超市則是天天有價。
 *
 * 這件事刻意保留在假資料裡，因為它會逼畫面處理一個真資料一定會遇到的狀態：**今天沒有
 * 資料，要退回上一個有交易的日子，而且必須告訴使用者看到的是哪一天的價。** 如果假資料
 * 天天都有價，這個分支到真資料階段才會第一次被執行，那就太晚了。
 */
export function isClosed(venue: VenueKey, dateISO: string): boolean {
  return venue === "wholesale" && weekdayOf(dateISO) === 1;
}

/** 從指定日期往前找最近一個有交易的日子。最多往前找 10 天，再找不到就回傳原本的日期
 *  （真資料階段遇得到「連假整週沒開市」，但不該讓迴圈無上限地走下去）。 */
export function latestTradingDate(venue: VenueKey, dateISO: string): string {
  let cursor = dateISO;
  for (let i = 0; i < 10; i++) {
    if (!isClosed(venue, cursor)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return dateISO;
}

/* ───────────────────── 價格生成 ───────────────────── */

/** 某品項在某場所、某一天的「全場所代表價」（元/公斤），不分市場。 */
function basePriceKg(code: string, venue: VenueKey, dateISO: string): number {
  const item = findItem(code);
  if (!item) return 0;

  const day = dayIndex(dateISO);
  const amp = VOLATILITY[item.category] ?? 0.6;

  // 產季的東西便宜、非產季貴（不是當季的品項在目錄裡 season 是空陣列，一律當成 1.0，
  // 不要給全年都有的東西硬加一個季節性折扣）。
  const seasonal = item.season.length === 0 ? 1 : isInSeason(item, monthOf(dateISO)) ? 0.84 : 1.18;

  // 兩層噪聲疊起來：30 天一節的慢波（產季推移、整體行情），5 天一節的快波（天氣、
  // 到貨量）。幅度乘上類別的波動倍率。
  //
  // **噪聲的 key 只有品項、刻意不含場所**：一場大雨讓高麗菜缺貨時，批發、傳統市場、
  // 超市是一起漲的，不是各漲各的。更要緊的是，各場所各自抽一組噪聲的話（這裡原本的
  // 寫法），±28% 的波動會蓋過場所之間的倍率差距（傳統市場→超市只差 25%），於是會出現
  // 「超市比傳統市場便宜」的日子——那會讓詳情頁的「哪裡買比較便宜」給出錯誤的建議。
  const slow = 1 + 0.18 * amp * valueNoise(`${code}|slow`, day, 30);
  // 快波的幅度（0.16）刻意比慢波差不多大：葉菜本來就會一天漲兩成，而畫面上「比昨天漲
  // 幾 %」要有東西可看。幅度太小的話（原本是 0.1），大部分品項的日間變化都落在漲跌徽章
  // 的 1.5% 死區裡，首頁的「今天漲最多」會變成一排 ▲2%，看不出重點。
  const fast = 1 + 0.16 * amp * valueNoise(`${code}|fast`, day, 5);

  // 場所自己的小幅擺動（±4%）：讓三條線不是完全成比例的平行線，但幅度遠小於場所之間的
  // 倍率差距，所以不會翻轉「批發 < 傳統市場 < 超市」的順序。
  const venueJitter = 1 + 0.04 * valueNoise(`${code}|${venue}|jitter`, day, 11);

  const multiplier = VENUE_MULTIPLIER[venue];
  const price = item.baseKg * multiplier * seasonal * slow * fast * venueJitter;

  // 價格保留一位小數——農業部的原始資料就是這個精度（例如 55.6 元/公斤）。
  // 下限用基準價的兩成，避免噪聲疊在一起時算出接近 0 的荒謬價格。下限**也要乘上場所
  // 倍率**，不然碰到下限的那幾天三個場所會被夾成同一個數字，順序又翻掉。
  return Math.max(Math.round(price * 10) / 10, Math.round(item.baseKg * multiplier * 0.2 * 10) / 10);
}

/**
 * 某品項在某場所、某一天的各市場明細。
 *
 * 各市場之間的差距用「市場固定偏移」＋「每天的小抖動」兩段：固定偏移讓同一個市場長期
 * 偏貴或偏便宜（真實世界就是這樣，台北的市場就是比西螺貴），小抖動才是逐日的差異。
 * 只有逐日抖動的話，同一個市場今天最便宜、明天最貴，使用者沒辦法從中學到「我家附近
 * 那個市場大概偏貴一成」這種真正有用的事。
 */
export function marketQuotesOf(code: string, venue: VenueKey, dateISO: string): MarketQuote[] {
  const avg = basePriceKg(code, venue, dateISO);
  if (avg <= 0) return [];
  const day = dayIndex(dateISO);

  return marketsOfVenue(venue).map((market) => {
    const fixedOffset = (unit(`${code}|${market.code}|offset`) - 0.5) * 0.24; // ±12%
    const daily = 0.06 * valueNoise(`${code}|${market.code}|d`, day, 3);
    const marketAvg = Math.max(1, Math.round(avg * (1 + fixedOffset + daily) * 10) / 10);

    // 上價／下價：真資料裡這是同一天成交的最高與最低價，散開的幅度本身就是「品質落差
    // 大不大」的訊號（葉菜散得開、肉品散得窄）。這裡用類別波動倍率決定散開幅度。
    const item = findItem(code);
    const spread = 0.18 * (VOLATILITY[item?.category ?? "veg"] ?? 0.6) + 0.08;
    const high = Math.round(marketAvg * (1 + spread) * 10) / 10;
    const low = Math.round(marketAvg * (1 - spread * 0.7) * 10) / 10;

    return {
      marketCode: market.code,
      marketName: market.name,
      city: market.city,
      avgKg: marketAvg,
      highKg: high,
      lowKg: low,
      // 交易量只有批發行情有（零售訪價沒有這個欄位），單位是公斤。
      volumeKg: venue === "wholesale" ? Math.round(500 + unit(`${code}|${market.code}|${day}|v`) * 9500) : undefined,
    };
  });
}

/**
 * 近 N 天的走勢。休市日會被跳過（不是補 0，也不是補前一天的價）——補值會讓折線圖看
 * 起來像那天真的有交易，而「那天沒開市」本身就是使用者該知道的事實。
 *
 * marketCode 給值時只取那個市場的線，空字串是全場所均價。
 */
export function buildSeries(code: string, venue: VenueKey, endISO: string, days: number, marketCode = ""): PricePoint[] {
  const points: PricePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(endISO, -i);
    if (isClosed(venue, date)) continue;
    const avgKg = marketCode
      ? (marketQuotesOf(code, venue, date).find((m) => m.marketCode === marketCode)?.avgKg ?? 0)
      : basePriceKg(code, venue, date);
    if (avgKg > 0) points.push({ date, avgKg });
  }
  return points;
}

/** 近一年統計的快取。
 *
 *  為什麼需要它：一列清單的「划算度」要拿今天的價格跟近一年均價比，而近一年均價是 365
 *  天逐日算出來的；整份目錄八十幾項、首頁的快報又要再掃一次同樣的資料，不快取的話同一
 *  組數字會被算好幾遍（每次切換場所、打一個字做搜尋都重算）。
 *
 *  快取安全的前提是「同樣的輸入永遠得到同樣的輸出」——這個檔案裡的價格完全由字串雜湊
 *  決定，沒有亂數也沒有時鐘，所以成立。key 帶上日期，跨日自然失效。
 *
 *  上限 4000 筆（約等於 80 個品項 × 3 個場所 × 十幾天）之後整個清掉，不做 LRU：這是
 *  同一次請求／同一個分頁活著期間的暫存，不是長命的快取，清掉最多就是重算一次。 */
const yearStatsCache = new Map<string, { lowKg: number; highKg: number; avgKg: number }>();

function yearStats(code: string, venue: VenueKey, date: string, marketCode: string, fallback: number) {
  const key = `${code}|${venue}|${marketCode}|${date}`;
  const hit = yearStatsCache.get(key);
  if (hit) return hit;

  const year = buildSeries(code, venue, date, 365, marketCode);
  const values = year.map((p) => p.avgKg);
  const stats = {
    lowKg: values.length ? Math.min(...values) : fallback,
    highKg: values.length ? Math.max(...values) : fallback,
    avgKg: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : fallback,
  };

  if (yearStatsCache.size > 4000) yearStatsCache.clear();
  yearStatsCache.set(key, stats);
  return stats;
}

/**
 * 組出一個品項在某場所的完整今日行情：代表價、昨日價（算漲跌用）、近一年統計
 * （判定便宜或貴用）、各市場明細。
 *
 * `date` 回傳的是**實際有資料的那一天**，不一定等於傳進來的 dateISO——批發行情週一
 * 休市時會退回週日。呼叫端要拿這個欄位跟「今天」比對，不一樣就在畫面上標示資料日期，
 * 不要讓使用者以為看到的是今天的價。
 */
export function buildQuote(code: string, venue: VenueKey, dateISO: string, marketCode = ""): PriceQuote {
  const date = latestTradingDate(venue, dateISO);
  const markets = marketQuotesOf(code, venue, date);
  const picked = marketCode ? markets.find((m) => m.marketCode === marketCode) : undefined;
  const avgKg = picked ? picked.avgKg : basePriceKg(code, venue, date);

  // 前一個交易日。批發行情的「昨天」在週二看是上週日，不是週一。
  const prevDate = latestTradingDate(venue, addDays(date, -1));
  const prevMarkets = marketCode ? marketQuotesOf(code, venue, prevDate) : [];
  const prevKg = marketCode
    ? (prevMarkets.find((m) => m.marketCode === marketCode)?.avgKg ?? null)
    : basePriceKg(code, venue, prevDate);

  // 近一年統計。365 天逐日算完才有「今天在這一年裡算便宜還是貴」可以講——這是這個
  // 工具對「不懂買菜價格的人」最有價值的一句話，比單純顯示漲跌更有用。
  const { lowKg: yearLowKg, highKg: yearHighKg, avgKg: yearAvgKg } = yearStats(code, venue, date, marketCode, avgKg);

  return {
    code,
    date,
    venue,
    avgKg,
    prevKg: prevKg && prevKg > 0 ? prevKg : null,
    yearLowKg,
    yearHighKg,
    yearAvgKg,
    // 假資料一律當成「這個場所自己的實際行情」，只有超市量販照真實世界的情況標成推估。
    source: venue === "super" ? "derived" : venue === "market" ? "retail" : "wholesale",
    estimated: venue === "super",
    // 假資料天天都算得出來，所以歷史永遠是滿的——測試划算度判定時不會被歷史長度的門檻擋住。
    historyDays: 365,
    markets,
  };
}

/** 一次組出多個品項的行情（行情頁、首頁清單用）。 */
export function buildQuotes(codes: string[], venue: VenueKey, dateISO: string, marketCode = ""): PriceQuote[] {
  return codes.map((code) => buildQuote(code, venue, dateISO, marketCode));
}
