/** 菜鳥不買貴（FreshWise）功能回歸測試——每次改完 lib/freshwise/* 之後跑一次，取代手動
 *  重新點一遍整個工具。
 *
 *  跟記帳本那支（expenses-feature-check.mts）最大的不同是**這支完全不需要資料庫、也不
 *  需要 .env.local**：這個工具現階段沒有伺服器端儲存，所有邏輯（假價格生成、單位換算、
 *  漲跌與划算度判定、搜尋排序、菜籃操作）都是純函式，直接呼叫就能驗證。等之後接上
 *  MongoDB，再照記帳本那支的做法補上「建測試帳號 → 跑 server 函式 → 清乾淨」那一段。
 *
 *  驗證的重點順序（也是這個工具最容易壞掉的順序）：
 *    1. 假價格的可重現性——這是整個工具能不能用 Server Component 算繪的前提。同一組
 *       輸入算出不同數字的話，React hydration 會直接報錯，而且是只在正式環境才明顯的
 *       那種錯。
 *    2. 單位換算——資料層全部是元/公斤、畫面上是元/台斤，少換一次就是整頁數字錯 1.67
 *       倍，而且每個數字看起來都還很合理，肉眼抓不到。
 *    3. 休市退回上一個交易日——批發行情週一沒有資料，這條分支在真資料階段天天都會走到。
 *    4. 菜籃的增刪改與排序——使用者唯一會「寫入」的東西。
 *
 *  用法：
 *    npx tsx scripts/freshwise-feature-check.mts
 *    npm run check:freshwise
 *
 *  結束碼：全部通過是 0，有任何一項失敗是 1（可以接 CI 或 pre-push hook）。
 *  詳細報告另外寫一份到 scripts/.freshwise-check-report.txt（已在 .gitignore 裡）。
 */
import { writeFileSync } from "node:fs";

const catalog = await import("../lib/freshwise/catalog");
const dates = await import("../lib/freshwise/dates");
const mock = await import("../lib/freshwise/mock-prices");
const price = await import("../lib/freshwise/price");
const search = await import("../lib/freshwise/search");
const basketLib = await import("../lib/freshwise/basket");
const advice = await import("../lib/freshwise/advice");
const prefsCookie = await import("../lib/freshwise/prefs-cookie");
const sourceMap = await import("../lib/freshwise/source-map");
const moaClient = await import("../lib/freshwise/moa-client");

// ── 小小的測試工具 ──────────────────────────────────────────────────────────
const lines: string[] = [];
let passCount = 0;
let failCount = 0;

function log(s: string) {
  lines.push(s);
  console.log(s);
}

function section(name: string) {
  log(`\n■ ${name}`);
}

function check(label: string, cond: unknown, detail?: string) {
  if (cond) {
    passCount++;
    log(`  ✅ ${label}`);
  } else {
    failCount++;
    log(`  ❌ ${label}${detail ? `（${detail}）` : ""}`);
  }
}

/** 包住一整個區塊：區塊裡丟出例外不會讓整支腳本中斷，記成一項失敗，繼續跑下一段。
 *  不然前面一個功能真的壞掉，後面十幾段的驗證結果就全部看不到了。 */
function run(name: string, fn: () => void) {
  section(name);
  try {
    fn();
  } catch (error) {
    failCount++;
    log(`  ❌ 整段拋出例外：${(error as Error).message}`);
  }
}

/** 把假資料組成一本「價格簿」，形狀跟伺服器端真正傳給畫面的一樣（lib/freshwise/
 *  prices.server.ts 的 getPriceBook）。這樣就能用可重現的假資料驗證搜尋、排序、快報
 *  這些純邏輯，不必連真的 API——真資料每天都在變，測試會莫名失敗，而且跑一次測試不該
 *  打一輪外部 API。 */
function bookOf(venue: "market" | "super" | "wholesale", date: string, codes?: string[]) {
  const list = codes ?? catalog.TRACKED_CATALOG.map((i) => i.code);
  const quotes: Record<string, ReturnType<typeof mock.buildQuote>> = {};
  for (const code of list) quotes[code] = mock.buildQuote(code, venue, date);
  return { dataDate: mock.latestTradingDate(venue, date), quotes, markets: [] };
}

/** 測試用的固定日期，不是「今天」——用今天的話，走到跨年、跨產季時結果會變，
 *  測試就會在某些日子莫名失敗。2026-11-20 是週五（批發市場有開市）。 */
const DAY = "2026-11-20";
/** 2026-11-23 是週一，批發市場休市。 */
const CLOSED_MONDAY = "2026-11-23";

log(`菜鳥不買貴功能檢查 — 基準日 ${DAY}`);

// ── 1. 品項目錄與市場清單 ────────────────────────────────────────────────
run("品項目錄", () => {
  const { CATALOG, CATEGORIES, MARKETS, VENUES } = catalog;

  check("目錄不是空的", CATALOG.length > 0, `${CATALOG.length} 項`);
  log(`  · 共 ${CATALOG.length} 個品項、${CATEGORIES.length} 個分類、${MARKETS.length} 個市場、${VENUES.length} 個場所`);

  const codes = CATALOG.map((i) => i.code);
  check("品項代碼沒有重複", new Set(codes).size === codes.length);

  const names = CATALOG.map((i) => i.name);
  check("品項名稱沒有重複", new Set(names).size === names.length);

  const validCategories = new Set(CATEGORIES.map((c) => c.key));
  check(
    "每個品項的分類都在分類清單裡",
    CATALOG.every((i) => validCategories.has(i.category)),
  );
  check(
    "每個分類都至少有一個品項",
    CATEGORIES.every((c) => CATALOG.some((i) => i.category === c.key)),
  );
  check(
    "基準價都是正數",
    CATALOG.every((i) => i.baseKg > 0),
  );
  check(
    "產季月份都在 1～12 之間、沒有重複",
    CATALOG.every((i) => i.season.every((m) => m >= 1 && m <= 12) && new Set(i.season).size === i.season.length),
  );
  check(
    "每個品項都有圖示",
    CATALOG.every((i) => i.icon.length > 0),
  );
  check(
    "別名不會跟自己的名稱重複",
    CATALOG.every((i) => !i.aliases.includes(i.name)),
  );

  // 找不到的代碼要給佔位品項，不是 undefined——使用者的菜籃裡可能留著已下架的代碼，
  // 那時候畫面要還能畫出一列，不是整頁炸掉。
  check("findItem 找得到既有品項", catalog.findItem("FA1")?.name === "甘藍");
  check("findItem 找不到時回 undefined", catalog.findItem("NOPE") === undefined);
  check("itemOrPlaceholder 找不到時回佔位品項", catalog.itemOrPlaceholder("NOPE").name === "已下架品項");
});

run("市場與場所", () => {
  const { MARKETS, VENUES } = catalog;

  const marketCodes = MARKETS.map((m) => m.code);
  check("市場代號沒有重複", new Set(marketCodes).size === marketCodes.length);
  check(
    "每個場所都至少有一個市場",
    VENUES.every((v) => catalog.marketsOfVenue(v.key).length > 0),
  );
  check("marketsOfVenue 只回傳該場所的市場", catalog.marketsOfVenue("wholesale").every((m) => m.venue === "wholesale"));
  check("marketName 查得到名稱", catalog.marketName("109") === "台北一");
  check("marketName 查不到時回空字串", catalog.marketName("XXX") === "");

  // 超市量販是推估值，一定要被標成 estimated，不然畫面上不會出現「估算」徽章。
  check("超市量販被標成推估值", catalog.venueMeta("super").estimated === true);
  check("傳統市場與批發行情不是推估值", !catalog.venueMeta("market").estimated && !catalog.venueMeta("wholesale").estimated);
  check("批發市場預設用公斤、傳統市場預設用台斤", catalog.venueDefaultUnit("wholesale") === "kg" && catalog.venueDefaultUnit("market") === "catty");

  // 場所的命名要照使用者會講的地點（市場／大賣場／超市），不要用業界詞。
  check("場所名稱是地點而不是資料名稱", catalog.venueName("wholesale") === "批發市場" && catalog.venueName("super") === "超市／大賣場");

  // 推估倍數必須是「區間」而且下限不小於 1——零售比批發便宜是不可能的，那種倍數出現
  // 代表資料或邏輯有問題。
  const ranges = Object.values(catalog.ESTIMATE_RANGE);
  check("每個分類都有推估倍數區間", ranges.length === catalog.CATEGORIES.length);
  check("推估倍數的下限都不小於 1", ranges.every((r) => r.low >= 1));
  check("推估倍數的上限都大於下限", ranges.every((r) => r.high > r.low));
  check("超市相對傳統市場的倍數是貴一到三成多", catalog.SUPER_OVER_MARKET.low >= 1 && catalog.SUPER_OVER_MARKET.high <= 1.5);
});

// ── 2. 日期工具 ──────────────────────────────────────────────────────────
run("日期工具", () => {
  check("addDays 跨月正確", dates.addDays("2026-11-30", 1) === "2026-12-01");
  check("addDays 跨年正確", dates.addDays("2026-12-31", 1) === "2027-01-01");
  check("addDays 往前跨月正確", dates.addDays("2026-03-01", -1) === "2026-02-28");
  check("閏年的 2 月 29 日存在", dates.addDays("2028-02-28", 1) === "2028-02-29");
  check("diffDays 算得出天數", dates.diffDays("2026-11-01", "2026-11-20") === 19);
  check("monthOf 回傳 1～12 的月份", dates.monthOf(DAY) === 11);
  check("weekdayOf 認得週五", dates.weekdayOf(DAY) === 5);
  check("weekdayOf 認得週一", dates.weekdayOf(CLOSED_MONDAY) === 1);
  check("dayIndex 相鄰兩天差 1", dates.dayIndex("2026-11-21") - dates.dayIndex(DAY) === 1);

  // 民國年：農產品的 API 用 115.11.20、漁產品用 1151120，兩種格式都要出得來。
  check("toROC 帶點的格式", dates.toROC(DAY) === "115.11.20");
  check("toROC 不帶點的格式", dates.toROC(DAY, "") === "1151120");
  check("formatShortDate 帶星期", dates.formatShortDate(DAY) === "11/20（五）");
  // todayISO 必須以台灣時間為準，不是伺服器時區（正式環境在 Vercel，時區是 UTC）。
  // 原本用 UTC 日界算，台灣時間凌晨 0～8 點整個工具會顯示「昨天」。
  check("todayISO 回傳 YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(dates.todayISO()));
  check(
    "todayISO 跟台灣時區的日期一致",
    dates.todayISO() ===
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  );
  check(
    "台灣時間凌晨時 todayISO 不會退回 UTC 的昨天",
    (() => {
      const taipeiHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false }).format(new Date()));
      // 只有台灣時間 0～7 點這個區間才分得出兩者的差別；其他時段這條驗證沒有意義，
      // 直接當成通過（上面那條已經確認了時區來源是對的）。
      if (taipeiHour >= 8) return true;
      return dates.todayISO() !== dates.toISO(Date.now());
    })(),
  );

  check("parseISO 遇到壞格式會丟例外", (() => {
    try {
      dates.parseISO("2026/11/20");
      return false;
    } catch {
      return true;
    }
  })());
});

// ── 3. 假價格的可重現性（最重要的一段）────────────────────────────────────
run("假價格的可重現性", () => {
  const a = mock.buildQuote("FA1", "market", DAY);
  const b = mock.buildQuote("FA1", "market", DAY);
  check("同一組輸入算兩次完全一樣", JSON.stringify(a) === JSON.stringify(b), `${a.avgKg} vs ${b.avgKg}`);

  // 價格要「每天都不太一樣」，但不保證任意兩天一定不同（相鄰幾天剛好四捨五入到同一個
  // 數字是正常的）。所以驗的是整段走勢的變化程度，不是挑兩天比大小——後者會因為巧合而
  // 隨機失敗，那種測試比沒有更糟。
  const month = mock.buildSeries("FA1", "market", DAY, 30).map((p) => p.avgKg);
  check("30 天裡至少有 15 個不同的價格", new Set(month).size >= 15, `${new Set(month).size} 個不同值`);
  check("30 天裡的最高與最低差距超過 5%", Math.max(...month) / Math.min(...month) > 1.05);

  const otherItem = mock.buildQuote("FA2", "market", DAY);
  check("不同品項算出不同價格", otherItem.avgKg !== a.avgKg);

  const otherVenue = mock.buildQuote("FA1", "super", DAY);
  check("不同場所算出不同價格", otherVenue.avgKg !== a.avgKg);

  check("價格是正數", a.avgKg > 0);
  check("近一年區間包含今天的價格", a.avgKg >= a.yearLowKg && a.avgKg <= a.yearHighKg);
  check("近一年平均落在最低與最高之間", a.yearAvgKg >= a.yearLowKg && a.yearAvgKg <= a.yearHighKg);
  check("各市場明細的數量等於該場所的市場數", a.markets.length === catalog.marketsOfVenue("market").length);
  check(
    "每個市場的上價 ≥ 均價 ≥ 下價",
    a.markets.every((m) => m.highKg >= m.avgKg && m.avgKg >= m.lowKg),
  );
  check("傳統市場的明細沒有交易量欄位", a.markets.every((m) => m.volumeKg === undefined));
  check(
    "批發行情的明細有交易量",
    mock.buildQuote("FA1", "wholesale", DAY).markets.every((m) => typeof m.volumeKg === "number"),
  );

  // 指定市場時，代表價要等於那個市場的均價，不是全場所均價——這條錯掉的話，使用者選了
  // 「我家附近那個市場」卻看到全國平均，而且完全看不出來。
  const picked = catalog.marketsOfVenue("market")[2];
  const scoped = mock.buildQuote("FA1", "market", DAY, picked.code);
  const inList = scoped.markets.find((m) => m.marketCode === picked.code);
  check("指定市場時代表價等於該市場的均價", inList !== undefined && scoped.avgKg === inList.avgKg);
  check("指定市場的價格跟全場所均價不同", scoped.avgKg !== a.avgKg);
});

run("場所的價差方向", () => {
  // 批發 < 傳統市場 < 超市，這個順序在任何一天、任何品項都該成立——它是整個工具「哪裡
  // 買比較便宜」那一塊的基礎。隨機挑十個品項、連續五天一起驗。
  const codes = catalog.CATALOG.slice(0, 10).map((i) => i.code);
  let wrong = 0;
  for (const code of codes) {
    for (let d = 0; d < 5; d++) {
      const day = dates.addDays(DAY, -d);
      const w = mock.buildQuote(code, "wholesale", day).avgKg;
      const m = mock.buildQuote(code, "market", day).avgKg;
      const s = mock.buildQuote(code, "super", day).avgKg;
      if (!(w < m && m < s)) wrong++;
    }
  }
  check("批發 < 傳統市場 < 超市量販（10 個品項 × 5 天）", wrong === 0, `${wrong} 組不符`);

  check("超市的報價被標成推估值", mock.buildQuote("FA1", "super", DAY).estimated === true);
  check("傳統市場的報價不是推估值", mock.buildQuote("FA1", "market", DAY).estimated === false);
  check("報價帶著來源", mock.buildQuote("FA1", "market", DAY).source === "retail");
});

// ── 4. 休市 ─────────────────────────────────────────────────────────────
run("休市與資料日期", () => {
  check("批發市場週一休市", mock.isClosed("wholesale", CLOSED_MONDAY));
  check("批發市場週五不休市", !mock.isClosed("wholesale", DAY));
  check("傳統市場不休市", !mock.isClosed("market", CLOSED_MONDAY));
  check("超市不休市", !mock.isClosed("super", CLOSED_MONDAY));

  check("latestTradingDate 從週一退回週日", mock.latestTradingDate("wholesale", CLOSED_MONDAY) === "2026-11-22");
  check("latestTradingDate 開市日不動", mock.latestTradingDate("wholesale", DAY) === DAY);

  const quote = mock.buildQuote("FA1", "wholesale", CLOSED_MONDAY);
  check("休市日查批發行情會退回上一個交易日", quote.date === "2026-11-22", quote.date);
  check("退回之後仍然算得出價格", quote.avgKg > 0);

  // 走勢圖不補休市日的值——補了會讓折線圖看起來像那天真的有交易。
  const series = mock.buildSeries("FA1", "wholesale", DAY, 14);
  check("批發走勢跳過所有週一", series.every((p) => dates.weekdayOf(p.date) !== 1));
  check("14 天的批發走勢剩 12 個交易日", series.length === 12, `${series.length} 個`);
  check("零售走勢 14 天就是 14 個點", mock.buildSeries("FA1", "market", DAY, 14).length === 14);
  check(
    "走勢的日期是遞增的",
    series.every((p, i) => i === 0 || dates.diffDays(series[i - 1].date, p.date) > 0),
  );
  check("走勢的最後一天就是查詢的那一天", series[series.length - 1].date === DAY);
});

// ── 5. 單位換算與格式化 ──────────────────────────────────────────────────
run("單位換算與格式化", () => {
  check("1 台斤 = 0.6 公斤", price.KG_PER_CATTY === 0.6);
  check("公斤價換台斤價", price.toUnit(100, "catty") === 60);
  check("公斤價換公斤價不變", price.toUnit(100, "kg") === 100);
  check("台斤價換回公斤價", Math.round(price.fromUnit(60, "catty")) === 100);
  check("換過去再換回來不會失真", Math.abs(price.fromUnit(price.toUnit(37.5, "catty"), "catty") - 37.5) < 1e-9);
  check("單位標籤正確", price.unitLabel("catty") === "元/台斤" && price.unitLabel("kg") === "元/公斤");

  check("10 元以上取整數", price.formatPrice(48.4) === "48" && price.formatPrice(48.6) === "49");
  check("10 元以下留一位小數", price.formatPrice(8.44) === "8.4");
  // 9.96 直接套一位小數會印成「10.0」，擺在一排整數裡看起來像另一種格式。
  check("接近 10 元時不會印成 10.0", price.formatPrice(9.96) === "10");
  check("9.9 還是留一位小數", price.formatPrice(9.94) === "9.9");
  check("0 或負數顯示破折號", price.formatPrice(0) === "—" && price.formatPrice(-5) === "—");
  check("NaN 也顯示破折號", price.formatPrice(Number.NaN) === "—");
  check("formatPriceIn 會先換算再格式化", price.formatPriceIn(100, "catty") === "60");
  check("金額加千分位", price.formatMoney(1280) === "1,280" && price.formatMoney(1280.4) === "1,280");
});

// ── 6. 漲跌與划算度 ─────────────────────────────────────────────────────
run("漲跌判定", () => {
  check("上漲", price.trendOf({ avgKg: 110, prevKg: 100 }).direction === "up");
  check("下跌", price.trendOf({ avgKg: 90, prevKg: 100 }).direction === "down");
  check("幅度在死區內算持平", price.trendOf({ avgKg: 101, prevKg: 100 }).direction === "flat");
  check("漲跌百分比正確", price.trendOf({ avgKg: 112, prevKg: 100 }).percent === 12);
  check("跌的百分比是負數", price.trendOf({ avgKg: 88, prevKg: 100 }).percent === -12);
  check("沒有前一天資料時算持平", price.trendOf({ avgKg: 100, prevKg: null }).direction === "flat");
  check("前一天價格是 0 時不會除以 0", Number.isFinite(price.trendOf({ avgKg: 100, prevKg: 0 }).percent));
  check("徽章文字", price.trendLabel(price.trendOf({ avgKg: 112, prevKg: 100 })) === "▲ 12%");
  check("持平的徽章文字", price.trendLabel(price.trendOf({ avgKg: 100, prevKg: 100 })) === "持平");
});

run("划算度判定", () => {
  const cheap = price.valueOf({ avgKg: 80, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 });
  const fair = price.valueOf({ avgKg: 100, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 });
  const pricey = price.valueOf({ avgKg: 125, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 });

  check("比平常便宜兩成算划算", cheap.level === "cheap" && cheap.percent === -20);
  check("跟平常一樣算正常價", fair.level === "fair");
  check("比平常貴兩成半算偏貴", pricey.level === "pricey");
  check("剛好在門檻上算划算", price.valueOf({ avgKg: 90, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 }).level === "cheap");
  check("差一點點沒到門檻算正常價", price.valueOf({ avgKg: 91, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 }).level === "fair");

  check("今年最低時位置是 0", price.valueOf({ avgKg: 70, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 }).position === 0);
  check("今年最高時位置是 1", price.valueOf({ avgKg: 130, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 }).position === 1);
  check("位置永遠在 0～1 之間", price.valueOf({ avgKg: 999, yearAvgKg: 100, yearLowKg: 70, yearHighKg: 130 }).position === 1);
  check("區間寬度為 0 時不會除以 0", price.valueOf({ avgKg: 100, yearAvgKg: 100, yearLowKg: 100, yearHighKg: 100 }).position === 0.5);

  check("划算的說明句講「現在買划算」", price.valueSentence(cheap, 365).includes("划算"));
  check("偏貴的說明句建議晚點買", price.valueSentence(pricey, 365).includes("晚一點"));

  // 比較基準的說法要跟實際累積的天數一致——只有一百天的歷史不能說成「近一年」。
  check("歷史滿一年才說近一年", price.historyLabel(364) === "近一年");
  check("歷史只有一百天就說過去一百天", price.historyLabel(100) === "過去 100 天");
  check("說明句會帶上實際的比較基準", price.valueSentence(cheap, 100).includes("過去 100 天"));
  check("歷史夠長的說明句講近一年", price.valueSentence(cheap, 364).includes("近一年"));
});

run("走勢統計", () => {
  const points = mock.buildSeries("FA1", "market", DAY, 30);
  const stats = price.statsOf(points);
  check("統計的筆數等於走勢的點數", stats.count === points.length);
  check("最低 ≤ 平均 ≤ 最高", stats.minKg <= stats.avgKg && stats.avgKg <= stats.maxKg);
  check("變化百分比是頭尾相比", (() => {
    const expected = Math.round(((points[points.length - 1].avgKg - points[0].avgKg) / points[0].avgKg) * 100);
    return stats.changePercent === expected;
  })());
  check("空陣列不會壞掉", price.statsOf([]).count === 0);
});

// ── 7. 搜尋、篩選、排序 ─────────────────────────────────────────────────
run("搜尋與篩選", () => {
  const rows = search.rowsFromBook(bookOf("market", DAY).quotes, DAY);
  check("清單筆數等於有資料來源的品項數", rows.length === catalog.TRACKED_CATALOG.length);
  check(
    "每一列都有漲跌與划算度",
    rows.every((r) => r.trend !== undefined && r.value !== undefined),
  );

  const cabbage = catalog.findItem("FA1");
  check("用正式名稱搜得到", !!cabbage && search.matchesKeyword(cabbage, "甘藍"));
  check("用別名搜得到（高麗菜 → 甘藍）", !!cabbage && search.matchesKeyword(cabbage, "高麗菜"));
  check("部分字串搜得到", !!cabbage && search.matchesKeyword(cabbage, "高麗"));
  check("空關鍵字一律命中", !!cabbage && search.matchesKeyword(cabbage, "  "));
  check("搜不到的關鍵字不命中", !!cabbage && !search.matchesKeyword(cabbage, "鮭魚"));

  const veg = search.filterRows(rows, { category: "veg" });
  check("分類篩選只留該分類", veg.length > 0 && veg.every((r) => r.item.category === "veg"));
  check("空分類等於不篩選", search.filterRows(rows, { category: "" }).length === rows.length);

  const kw = search.filterRows(rows, { keyword: "魚" });
  check("關鍵字篩選有結果", kw.length > 0);
  check(
    "關鍵字篩選的結果都命中",
    kw.every((r) => search.matchesKeyword(r.item, "魚")),
  );

  const seasonal = search.filterRows(rows, { inSeasonOnly: true });
  check("只看當季的結果都是當季", seasonal.every((r) => r.inSeason));
  check("11 月有當季品項", seasonal.length > 0, `${seasonal.length} 項`);

  const cheapOnly = search.filterRows(rows, { cheapOnly: true });
  check("只看划算的結果都是划算", cheapOnly.every((r) => r.value.level === "cheap"));

  const both = search.filterRows(rows, { category: "veg", inSeasonOnly: true });
  check("兩個條件是「而且」不是「或者」", both.every((r) => r.item.category === "veg" && r.inSeason));
});

run("排序", () => {
  const rows = search.rowsFromBook(bookOf("market", DAY).quotes, DAY);

  const asc = search.sortRows(rows, "priceAsc");
  check("價格低到高", asc.every((r, i) => i === 0 || asc[i - 1].quote.avgKg <= r.quote.avgKg));

  const desc = search.sortRows(rows, "priceDesc");
  check("價格高到低", desc.every((r, i) => i === 0 || desc[i - 1].quote.avgKg >= r.quote.avgKg));

  const drop = search.sortRows(rows, "drop");
  check("跌最多排前面", drop.every((r, i) => i === 0 || drop[i - 1].trend.percent <= r.trend.percent));

  const rise = search.sortRows(rows, "rise");
  check("漲最多排前面", rise.every((r, i) => i === 0 || rise[i - 1].trend.percent >= r.trend.percent));

  // 成交量排序：沒有成交量的（零售訪價、推估）要排到後面，不要跟「成交量 0」混在一起。
  const byVolume = search.sortRows(rows, "volumeDesc");
  check(
    "成交量多的排前面",
    byVolume.every((r, i) => i === 0 || (byVolume[i - 1].quote.volumeKg ?? -1) >= (r.quote.volumeKg ?? -1)),
  );
  check(
    "沒有成交量的排在最後",
    (() => {
      const firstMissing = byVolume.findIndex((r) => typeof r.quote.volumeKg !== "number");
      const lastPresent = byVolume.map((r) => typeof r.quote.volumeKg === "number").lastIndexOf(true);
      return firstMissing === -1 || lastPresent < firstMissing;
    })(),
  );

  // 依名稱排序是「先分類分群、再在分類內照中文字典序」，不是把所有品項混在一起排。
  const byName = search.sortRows(rows, "name");
  check("依名稱排序後筆數不變", byName.length === rows.length);
  check(
    "依名稱排序會先照分類分群",
    (() => {
      const order = catalog.CATEGORIES.map((c) => c.key);
      const seen = byName.map((r) => order.indexOf(r.item.category));
      return seen.every((v, i) => i === 0 || seen[i - 1] <= v);
    })(),
  );
  check(
    "同一個分類內照中文字典序",
    (() => {
      const collator = new Intl.Collator("zh-TW");
      const veg = byName.filter((r) => r.item.category === "veg").map((r) => r.item.name);
      return veg.every((n, i) => i === 0 || collator.compare(veg[i - 1], n) <= 0);
    })(),
  );

  const cheapest = search.sortRows(rows, "cheapest");
  check("最划算排前面", cheapest.every((r, i) => i === 0 || cheapest[i - 1].value.percent <= r.value.percent));

  const recommended = search.sortRows(rows, "recommended");
  check("推薦排序把當季排在非當季前面", (() => {
    const firstNonSeason = recommended.findIndex((r) => !r.inSeason);
    const lastSeason = recommended.map((r) => r.inSeason).lastIndexOf(true);
    return firstNonSeason === -1 || lastSeason < firstNonSeason;
  })());

  check(
    "排序不會改到原本的陣列",
    rows.map((r) => r.item.code).join(",") === search.rowsFromBook(bookOf("market", DAY).quotes, DAY).map((r) => r.item.code).join(","),
  );
  check("排序後筆數不變", recommended.length === rows.length);
});

// ── 8. 我的菜籃 ─────────────────────────────────────────────────────────
run("菜籃：預設內容", () => {
  const state = basketLib.defaultBasket();
  check("預設有分類", state.groups.length > 0);
  check("預設有項目", state.entries.length > 0);
  check(
    "預設項目的代碼都存在於目錄裡",
    state.entries.every((e) => !!catalog.findItem(e.code)),
  );
  check(
    "預設項目都掛在存在的分類下",
    state.entries.every((e) => state.groups.some((g) => g.id === e.groupId)),
  );
  // 預設值的 id 必須是固定字串：這份資料在伺服器端算繪與瀏覽器端都會用到，id 每次不一樣
  // 的話 React hydration 會對不起來。
  check("預設分類的 id 是固定的", basketLib.defaultBasket().groups[0].id === state.groups[0].id);
  check("空菜籃真的是空的", basketLib.emptyBasket().groups.length === 0 && basketLib.emptyBasket().entries.length === 0);
});

run("菜籃：分類", () => {
  let state = basketLib.emptyBasket();

  state = basketLib.addGroup(state, "火鍋", "fire-burner");
  check("新增分類", state.groups.length === 1 && state.groups[0].name === "火鍋");
  check("第一個分類的順序是 0", state.groups[0].order === 0);

  state = basketLib.addGroup(state, "便當", "bowl-food");
  check("第二個分類的順序是 1", basketLib.groupsSorted(state)[1].order === 1);

  check("空白名稱不會新增", basketLib.addGroup(state, "   ", "x").groups.length === 2);

  const firstId = basketLib.groupsSorted(state)[0].id;
  state = basketLib.updateGroup(state, firstId, { name: "麻辣鍋" });
  check("改名字", basketLib.groupsSorted(state)[0].name === "麻辣鍋");
  state = basketLib.updateGroup(state, firstId, { name: "  " });
  check("改成空白名稱會被忽略", basketLib.groupsSorted(state)[0].name === "麻辣鍋");
  state = basketLib.updateGroup(state, firstId, { icon: "utensils" });
  check("換圖示", basketLib.groupsSorted(state)[0].icon === "utensils");

  // 換順序
  const ids = basketLib.groupsSorted(state).map((g) => g.id);
  state = basketLib.reorderGroups(state, [ids[1], ids[0]]);
  check("換順序", basketLib.groupsSorted(state).map((g) => g.id).join(",") === [ids[1], ids[0]].join(","));
  check("換順序後 order 是連續的 0,1", basketLib.groupsSorted(state).map((g) => g.order).join(",") === "0,1");
  state = basketLib.reorderGroups(state, [ids[0]]);
  check("傳進來的清單漏掉的分類不會被弄丟", state.groups.length === 2);

  // 刪分類要連項目一起刪
  state = basketLib.addEntry(state, ids[0], "FA1");
  state = basketLib.addEntry(state, ids[1], "FA2");
  state = basketLib.deleteGroup(state, ids[0]);
  check("刪分類", state.groups.length === 1);
  check("刪分類會連裡面的項目一起刪", state.entries.every((e) => e.groupId === ids[1]));
});

run("菜籃：項目", () => {
  let state = basketLib.emptyBasket();
  state = basketLib.addGroup(state, "常買", "basket-shopping");
  state = basketLib.addGroup(state, "火鍋", "fire-burner");
  const [g1, g2] = basketLib.groupsSorted(state).map((g) => g.id);

  state = basketLib.addEntry(state, g1, "FA1", 2);
  check("新增項目", state.entries.length === 1);
  check("記住份量", state.entries[0].qtyCatty === 2);

  state = basketLib.addEntry(state, g1, "FA1", 3);
  check("同一個分類不會重複加同一個品項", state.entries.length === 1);

  state = basketLib.addEntry(state, g2, "FA1");
  check("不同分類可以各有一筆同品項", state.entries.length === 2);
  check("沒填份量時是 null", basketLib.entriesOfGroup(state, g2)[0].qtyCatty === null);

  state = basketLib.addEntry(state, "不存在的分類", "FA2");
  check("加到不存在的分類會被忽略", state.entries.length === 2);

  state = basketLib.addEntry(state, g1, "FA2");
  state = basketLib.addEntry(state, g1, "FA3");
  check("同一分類的項目順序是 0,1,2", basketLib.entriesOfGroup(state, g1).map((e) => e.order).join(",") === "0,1,2");

  // 改份量
  const target = basketLib.entriesOfGroup(state, g1)[0];
  state = basketLib.updateEntry(state, target.id, { qtyCatty: 1.5 });
  check("改份量", basketLib.entriesOfGroup(state, g1)[0].qtyCatty === 1.5);
  state = basketLib.updateEntry(state, target.id, { qtyCatty: 0 });
  check("份量填 0 等於沒填", basketLib.entriesOfGroup(state, g1)[0].qtyCatty === null);

  // 換分類：新分類的順序要接在最後，舊分類要重新編號
  state = basketLib.updateEntry(state, target.id, { groupId: g2 });
  check("換分類", basketLib.entriesOfGroup(state, g2).some((e) => e.id === target.id));
  check("換過去的項目排在新分類的最後", basketLib.entriesOfGroup(state, g2).at(-1)?.id === target.id);
  check("舊分類的順序重新編號成 0,1", basketLib.entriesOfGroup(state, g1).map((e) => e.order).join(",") === "0,1");

  // 刪項目也要重新編號
  const toRemove = basketLib.entriesOfGroup(state, g1)[0];
  state = basketLib.removeEntry(state, toRemove.id);
  check("刪項目", !state.entries.some((e) => e.id === toRemove.id));
  check("刪完順序還是連續的", basketLib.entriesOfGroup(state, g1).map((e) => e.order).join(",") === "0");

  // 換順序
  state = basketLib.addEntry(state, g1, "FA4");
  state = basketLib.addEntry(state, g1, "FA5");
  const entryIds = basketLib.entriesOfGroup(state, g1).map((e) => e.id);
  state = basketLib.reorderEntries(state, g1, [...entryIds].reverse());
  check("換項目順序", basketLib.entriesOfGroup(state, g1).map((e) => e.id).join(",") === [...entryIds].reverse().join(","));
  check("換順序不會動到其他分類", basketLib.entriesOfGroup(state, g2).length === 2);

  check("countOfGroup 算得出筆數", basketLib.countOfGroup(state, g1) === 3);
  check("allCodes 不重複", new Set(basketLib.allCodes(state)).size === basketLib.allCodes(state).length);
});

run("菜籃：星星（加入／移除）", () => {
  let state = basketLib.defaultBasket();
  check("預設菜籃裡的品項是已加入狀態", basketLib.isInBasket(state, "FA1"));
  check("沒加過的品項是未加入狀態", !basketLib.isInBasket(state, "GC3"));

  state = basketLib.toggleBasket(state, "GC3");
  check("按星星會加進第一個分類", basketLib.isInBasket(state, "GC3"));
  check("加進去的是第一個分類", basketLib.entriesOfGroup(state, basketLib.groupsSorted(state)[0].id).some((e) => e.code === "GC3"));

  state = basketLib.toggleBasket(state, "GC3");
  check("再按一次會移除", !basketLib.isInBasket(state, "GC3"));

  // 同一個品項在兩個分類裡時，星星要全部移除（星星是「有沒有在菜籃裡」的開關，不是
  // 針對某一個分類）。
  let multi = basketLib.emptyBasket();
  multi = basketLib.addGroup(multi, "A", "x");
  multi = basketLib.addGroup(multi, "B", "y");
  const [ga, gb] = basketLib.groupsSorted(multi).map((g) => g.id);
  multi = basketLib.addEntry(multi, ga, "FA1");
  multi = basketLib.addEntry(multi, gb, "FA1");
  multi = basketLib.toggleBasket(multi, "FA1");
  check("在兩個分類裡的品項會被一起移除", !basketLib.isInBasket(multi, "FA1"));

  // 一個分類都沒有的時候按星星也要能加
  const noGroup = basketLib.toggleBasket(basketLib.emptyBasket(), "FA1");
  check("沒有分類時按星星會自動建一個", noGroup.groups.length === 1 && basketLib.isInBasket(noGroup, "FA1"));
});

run("菜籃：金額估算", () => {
  check("有份量就算得出金額", price.entryCost(2, 100) === 120); // 2 台斤 × 0.6 × 100 元/公斤
  check("沒填份量回 null", price.entryCost(null, 100) === null);
  check("份量是 0 回 null", price.entryCost(0, 100) === null);
  check("價格是 0 回 null", price.entryCost(2, 0) === null);

  const cost = price.basketCost([
    { qtyCatty: 2, priceKg: 100 },
    { qtyCatty: null, priceKg: 100 },
    { qtyCatty: 1, priceKg: 50 },
  ]);
  check("只加總有填份量的項目", cost.total === 150, `${cost.total}`);
  check("算得出有幾項被計入", cost.counted === 2);
  check("算得出有幾項沒填份量", cost.skipped === 1);
  check("全部沒填時總額是 0", price.basketCost([{ qtyCatty: null, priceKg: 100 }]).total === 0);
});

// ── 9. 首頁快報 ─────────────────────────────────────────────────────────
run("首頁快報", () => {
  const marketBook = bookOf("market", DAY);
  const briefRows = search.rowsFromBook(marketBook.quotes, DAY);
  const brief = advice.buildBrief(briefRows, DAY, marketBook.dataDate);
  check("建議句不是空的", brief.advice.length > 0);
  log(`  · 今天的建議：${brief.advice}`);
  check("建議句有具體品項或整體說明", brief.advice.includes("今天") || brief.advice.includes("月"));

  // 只有「今天值得買」是固定格數的貨架才限筆數；漲最多與當季在畫面上是可展開的完整
  // 清單（首頁用 CollapsibleList 收合），資料層不該先砍掉。
  check("最划算區塊不超過上限", brief.cheapest.length <= advice.BRIEF_LIMIT);
  check("漲最多區塊是完整清單", brief.risers.length === briefRows.filter((r) => r.trend.direction === "up").length);
  check("當季區塊不限筆數", brief.seasonal.length >= Math.min(advice.BRIEF_LIMIT, briefRows.filter((r) => r.inSeason).length));
  check("最划算區塊的每一列都真的划算", brief.cheapest.every((r) => r.value.level === "cheap"));
  check("漲最多區塊的每一列都真的在漲", brief.risers.every((r) => r.trend.direction === "up"));
  check("當季區塊的每一列都是當季", brief.seasonal.every((r) => r.inSeason));
  check("當季區塊不推薦偏貴的品項", brief.seasonal.every((r) => r.value.level !== "pricey"));
  check("最划算是由便宜到不便宜排的", brief.cheapest.every((r, i) => i === 0 || brief.cheapest[i - 1].value.percent <= r.value.percent));
  check("漲最多是由大到小排的", brief.risers.every((r, i) => i === 0 || brief.risers[i - 1].trend.percent >= r.trend.percent));

  check("資料日期等於查詢日（零售天天有價）", brief.dataDate === DAY && !brief.delayed);
  const closedBook = bookOf("wholesale", CLOSED_MONDAY);
  const closed = advice.buildBrief(search.rowsFromBook(closedBook.quotes, CLOSED_MONDAY), CLOSED_MONDAY, closedBook.dataDate);
  check("批發休市時快報會標成延遲", closed.delayed && closed.dataDate === "2026-11-22");

  check("漲跌計數加起來不超過品項總數", brief.upCount + brief.downCount <= catalog.TRACKED_CATALOG.length);
  check("總項數等於清單筆數", brief.total === briefRows.length);

  // 實際訪價要排在推估值前面。推估值經過係數放大後波動更劇烈，會霸占「今天最划算」的
  // 前幾名（實測看到推估出來的「比平常便宜 67%」），那會讓首頁的頭條建議變成一個
  // 我們其實沒有訪到的價格。
  const mixedRows = [
    ...search.rowsFromBook(bookOf("market", DAY).quotes, DAY),
    ...search.rowsFromBook(bookOf("super", DAY).quotes, DAY),
  ];
  const mixedBrief = advice.buildBrief(mixedRows, DAY, DAY);
  check(
    "最划算區塊把實際訪價排在推估值前面",
    (() => {
      const firstEstimated = mixedBrief.cheapest.findIndex((r) => r.quote.estimated);
      const lastMeasured = mixedBrief.cheapest.map((r) => r.quote.estimated).lastIndexOf(false);
      return firstEstimated === -1 || lastMeasured < firstEstimated;
    })(),
  );
  check(
    "建議句優先用實際訪價的品項",
    mixedBrief.cheapest.some((r) => !r.quote.estimated) ? !mixedBrief.advice.includes("（推估）") : true,
  );
  check("推估出來的建議句會標明是推估", (() => {
    const onlyEstimated = search.rowsFromBook(bookOf("super", DAY).quotes, DAY);
    const b = advice.buildBrief(onlyEstimated, DAY, DAY);
    // 超市量販整批都是推估值，所以如果有「最划算」的建議，句子裡一定要標。
    return b.cheapest.length === 0 || b.advice.includes("（推估）") || !b.advice.includes("便宜");
  })());

  // 同一批資料算兩次要完全一樣（理由同假價格那段：Server Component 與瀏覽器各算一次）。
  check(
    "同一批資料的快報算兩次一樣",
    JSON.stringify(advice.buildBrief(briefRows, DAY, marketBook.dataDate)) === JSON.stringify(brief),
  );

  const row = brief.cheapest[0] ?? search.rowsFromBook(bookOf("market", DAY, ["FA1"]).quotes, DAY)[0];
  check("快報的說明文字不是空的", advice.briefReason(row, "cheap").length > 0);
  check("一行摘要含品項名稱與單位", advice.rowSummary(row, "catty").includes(row.item.name) && advice.rowSummary(row, "catty").includes("元/台斤"));
});

// ── 10. 偏好設定的預設值 ────────────────────────────────────────────────
run("偏好設定（cookie）", () => {
  const prefs = prefsCookie.DEFAULT_PREFS;
  check("預設看傳統市場", prefs.venue === "market");
  check("預設用台斤", prefs.unit === "catty");
  check("預設看全部市場", prefs.marketCode === "");
  check("預設顯示買菜建議", prefs.showAdvice === true);
  check("提醒門檻在合理範圍", prefs.alertPercent >= 5 && prefs.alertPercent <= 50);
  // 伺服器端算繪用的就是這組預設值，所以它必須跟「傳統市場的慣用單位」一致，不然第一次
  // 畫面的單位跟切換場所後的單位會不一樣。
  check("預設單位跟預設場所的慣用單位一致", prefs.unit === catalog.venueDefaultUnit(prefs.venue));

  // cookie 的內容是使用者改得到的，而且改版後可能留下舊格式，所以逐欄位驗證、壞的退回
  // 預設值——一個壞欄位不該讓整組設定重置。
  const roundTrip = prefsCookie.parsePrefs(
    prefsCookie.serializePrefs({ ...prefs, venue: "wholesale", unit: "kg", marketCode: "109" }),
  );
  check("序列化再解析回來一樣", roundTrip.venue === "wholesale" && roundTrip.unit === "kg" && roundTrip.marketCode === "109");
  check("沒有 cookie 時回預設值", prefsCookie.parsePrefs(undefined).venue === prefs.venue);
  check("壞掉的 JSON 回預設值", prefsCookie.parsePrefs("not-json").venue === prefs.venue);
  check(
    "不認識的場所退回預設值",
    prefsCookie.parsePrefs(encodeURIComponent(JSON.stringify({ venue: "costco" }))).venue === prefs.venue,
  );
  check(
    "超出範圍的提醒門檻退回預設值",
    prefsCookie.parsePrefs(encodeURIComponent(JSON.stringify({ alertPercent: 999 }))).alertPercent === prefs.alertPercent,
  );
  check(
    "合法欄位會被保留、只有壞欄位退回預設",
    (() => {
      const mixed = prefsCookie.parsePrefs(encodeURIComponent(JSON.stringify({ venue: "wholesale", unit: "\u65a4" })));
      return mixed.venue === "wholesale" && mixed.unit === prefs.unit;
    })(),
  );
});

// ── 11. 開放資料的對應表 ────────────────────────────────────────────────
run("開放資料的對應表", () => {
  const codes = new Set(catalog.CATALOG.map((i) => i.code));
  const mapped = Object.keys(sourceMap.SOURCE_MAP);

  check("對應表不是空的", mapped.length > 0, `${mapped.length} 項`);
  check(
    "對應表裡的每個代碼都存在於目錄",
    mapped.every((code) => codes.has(code)),
    mapped.filter((code) => !codes.has(code)).join(","),
  );
  check("TRACKED_CATALOG 就是有對應的那些", catalog.TRACKED_CATALOG.length === mapped.length);
  check(
    "每一項至少有一個來源",
    mapped.every((code) => {
      const ref = sourceMap.SOURCE_MAP[code];
      return !!(ref.farm || ref.aquatic || ref.taichung || ref.poultry || ref.rice);
    }),
  );

  // 同一個臺中欄位被對到兩個品項的話，那一欄的價格會同時出現在兩樣菜上。
  const columns = mapped.flatMap((code) => sourceMap.SOURCE_MAP[code].taichung ?? []);
  check("臺中的欄位沒有被重複對應", new Set(columns).size === columns.length);

  // 米是唯一全國各縣市都有每日零售價的來源，欄位後綴不能重複對應（不然兩種米會共用
  // 同一欄的價格）。
  const riceFields = mapped.map((code) => sourceMap.SOURCE_MAP[code].rice).filter(Boolean);
  check("米的欄位後綴沒有重複", new Set(riceFields).size === riceFields.length, `${riceFields.length} 種米`);
  check("糧食分類的品項都對到糧價來源", catalog
    .itemsOfCategory("grain")
    .every((item) => !!sourceMap.SOURCE_MAP[item.code]?.rice));
  check("縣市代碼對照表有 20 個縣市", Object.keys(sourceMap.RICE_CITIES).length === 20);
  check("縣市代碼對到的是名稱不是數字", Object.values(sourceMap.RICE_CITIES).every((n) => /[一-鿿]/.test(n)));

  // 產銷履歷那支只有蔬果會回報標章，所以「有標章 vs 一般」只可能出現在有 farm 來源的
  // 品項上。肉、蛋、米不會有，畫面上也就不會出現那個區塊。
  const tracedCapable = mapped.filter((code) => !!sourceMap.SOURCE_MAP[code].farm);
  check("有標章比較只適用於有批發蔬果來源的品項", tracedCapable.length > 0, `${tracedCapable.length} 項`);
  check(
    "肉類與糧食不會有標章比較",
    catalog.CATALOG.filter((i) => i.category === "meat" || i.category === "grain").every(
      (i) => !sourceMap.SOURCE_MAP[i.code]?.farm,
    ),
  );

  // 名稱比對：exclude 一定要贏過 match，不然「虱目魚肚」會被當成「虱目魚」。
  check("比對命中", sourceMap.matchesName("甘藍-初秋", { match: ["甘藍"] }));
  check("exclude 優先於 match", !sourceMap.matchesName("甘藍-甘藍芽", { match: ["甘藍"], exclude: ["甘藍芽"] }));
  check("虱目魚不會命中魚肚", !sourceMap.matchesName("虱目魚肚", sourceMap.SOURCE_MAP.HA2.aquatic!));
  check("虱目魚本體會命中", sourceMap.matchesName("虱目魚", sourceMap.SOURCE_MAP.HA2.aquatic!));
  check("梨不會命中鳳梨", !sourceMap.matchesName("鳳梨-金鑽鳳梨", sourceMap.SOURCE_MAP.GB8.farm!));
  check("梨會命中新興梨", sourceMap.matchesName("梨-新興", sourceMap.SOURCE_MAP.GB8.farm!));
  check(
    "花椰菜與青花菜分得開",
    (() => {
      const cauliflower = sourceMap.SOURCE_MAP.FD3.farm!;
      const broccoli = sourceMap.SOURCE_MAP.FD4.farm!;
      return (
        sourceMap.matchesName("花椰菜-白梗", cauliflower) &&
        !sourceMap.matchesName("花椰菜-青梗", cauliflower) &&
        sourceMap.matchesName("花椰菜-青梗", broccoli) &&
        !sourceMap.matchesName("花椰菜-白梗", broccoli)
      );
    })(),
  );
});

run("開放資料的欄位清理", () => {
  // 民國年有三種格式：農產品 115.11.20（帶點補零）、漁產品 1151120（不帶點）、
  // 糧價 115.9.9（帶點但**不補零**）。最後那種原本會被整批丟掉，症狀是「每個月的
  // 1～9 日都沒有米價」，而且不會報錯。
  check("民國年帶點", moaClient.rocToISO("115.11.20") === "2026-11-20");
  check("民國年不帶點", moaClient.rocToISO("1151120") === "2026-11-20");
  check("民國年帶點但不補零（糧價）", moaClient.rocToISO("115.9.9") === "2026-09-09");
  check("月份不補零、日補零", moaClient.rocToISO("115.9.19") === "2026-09-19");
  check("月份補零、日不補零", moaClient.rocToISO("115.11.9") === "2026-11-09");
  check("太短的日期回 null", moaClient.rocToISO("115") === null);
  check("月份超出範圍回 null", moaClient.rocToISO("115.13.1") === null);
  check("段數不對回 null", moaClient.rocToISO("115.11") === null);
  check("西元斜線", moaClient.adToISO("2026/11/18") === "2026-11-18");
  check("西元純數字", moaClient.adToISO("20261118") === "2026-11-18");
  check("長度不對回 null", moaClient.adToISO("2026/11") === null);

  // 缺價在來源裡是字串 "0"，一定要當成「沒訪到」而不是 0 元——當成 0 會被算進平均裡，
  // 把整個市場的均價拉下來。
  check("字串數字轉得出來", moaClient.toPositiveNumber("48") === 48);
  check("小數字串轉得出來", moaClient.toPositiveNumber("55.6") === 55.6);
  check("缺價的 0 回 null", moaClient.toPositiveNumber("0") === null);
  check("數字 0 回 null", moaClient.toPositiveNumber(0) === null);
  check("負數回 null", moaClient.toPositiveNumber(-5) === null);
  check("空字串回 null", moaClient.toPositiveNumber("") === null);
  check("非數字回 null", moaClient.toPositiveNumber("\u2014") === null);
  check("帶逗號的數字", moaClient.toPositiveNumber("1,492") === 1492);
});

// ── 結果 ────────────────────────────────────────────────────────────────
log(`\n──────────────────────────────`);
log(`通過 ${passCount} 項，失敗 ${failCount} 項`);

const reportPath = "scripts/.freshwise-check-report.txt";
writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
log(`詳細報告：${reportPath}`);

process.exit(failCount > 0 ? 1 : 0);
