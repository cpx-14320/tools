// 伺服器端專用：把 moa-client.ts 拿回來的原始開放資料，整理成畫面要的 PriceQuote。
//
// ## 資料怎麼存
//
// 直接把原始資料存起來、每次請求再算一遍是不行的：農業部的行情一天約 3,200 筆、一年
// 一百多萬筆，而首頁要的只是「九十幾個品項今天各多少錢、跟昨天比、跟近一年比」。所以存
// 兩種整理過的東西：
//
// | 集合 | 內容 | 給誰用 |
// | --- | --- | --- |
// | `freshwise.snapshots` | 一天一個場所一份：每個品項的代表價＋各市場明細 | 今天的價格、漲跌、詳情頁的市場清單 |
// | `freshwise.series` | 一個場所一個品項一份：整段歷史的 [日期, 價格]＋預先算好的統計 | 走勢圖、划算度判定 |
//
// `series` 的統計（最低／最高／平均／天數）是**寫入時就算好**存在文件裡的，清單頁用
// projection 把 `points` 排除掉，一次讀九十幾個品項也只有幾 KB。不預先算的話，清單頁
// 每一列都要把一年的點搬回來再算一次。
//
// ## 歷史從哪來（這點很重要，也是目前最大的限制）
//
// - **零售（傳統市場）**：臺中那份檔案本身就是滾動一年，一抓就有完整歷史。這也是預設
//   場所，所以多數使用者第一天就看得到真實的一年走勢。
// - **批發**：農業部那支只能按日期區間查，查一年等於上百萬筆、十幾次分頁請求，不可能在
//   一次頁面算繪裡做完。所以批發的歷史是**從接上資料那天開始一天一天累積**的（頁面只確保
//   最近幾天；要補更久的歷史用 scripts/freshwise-sync.mts）。
//   天數不夠時 `historyDays` 會反映出來，畫面上就不說「比近一年平均便宜 X%」那句話。
// - **推估的場所**：超市量販沒有任何資料來源，一律從零售價乘係數推估；零售沒有訪價的
//   品項（大部分蔬果）則從批發價乘係數推估。這兩種都標 `estimated`。

import type { Collection } from "mongodb";
import { getDb } from "../mongodb";
import { ESTIMATE_RANGE, findItem, marketsOfVenue, SUPER_OVER_MARKET, VENUE_MULTIPLIER } from "./catalog";
import { addDays, diffDays, todayISO, weekdayOf } from "./dates";
import {
  adToISO,
  fetchAquaticRows,
  fetchFarmRows,
  fetchPoultryRows,
  fetchRiceRows,
  fetchTaichungRetail,
  fetchTracedRows,
  rocToISO,
  toPositiveNumber,
} from "./moa-client";
import { KG_PER_CATTY } from "./price";
import { matchesName, RICE_CITIES, SOURCE_MAP, sourceOf } from "./source-map";
import type {
  CategoryKey,
  ItemDetail,
  MarketOption,
  MarketQuote,
  PriceBook,
  PriceQuote,
  PricePoint,
  PriceSource,
  TracedCompare,
  VenueKey,
} from "./types";

/** 頁面算繪時最多確保幾天的批發資料。8 天足夠算出「今天」與「上一個交易日」
 *  （含週一休市與連假），又只要兩三次分頁請求。 */
const RECENT_DAYS = 8;

/** 歷史最多留幾天。臺中那份本來就是滾動一年，批發累積到一年也夠了。 */
const MAX_HISTORY_DAYS = 400;

/** 離群值防護：單一價格超過該品項基準價的這個倍數就丟掉。臺中那份實際見過白蝦
 *  7600 元/台斤（正常約 250），來源自己的單位填錯。不擋的話一筆錯誤資料就會把
 *  「近一年最高價」整個拉歪，划算度跟著失準。 */
const OUTLIER_RATIO = 6;

/** 已經停用的市場。臺中那份資料裡有「(停)建國市場」這種還留著歷史資料、但其實已經不
 *  營業的市場——列在「各市場今天的價格」裡會讓使用者跑一趟空門。 */
function isClosedMarket(name: string): boolean {
  return name.startsWith("(停)") || name.startsWith("（停）");
}

/* ───────────────────── 資料庫的形狀 ───────────────────── */

interface SnapshotEntry {
  avgKg: number;
  highKg: number;
  lowKg: number;
  /** 這一筆是哪個來源訪的價。**不能只看場所來推**——同一個「傳統市場」場所裡，蔬果魚肉蛋
   *  來自臺中訪價、米來自全國糧價，標錯會讓使用者以為米價也只是臺中一地的數字。
   *  舊資料沒有這個欄位，所以是選填，讀取時有預設值。 */
  source?: PriceSource;
  markets: MarketQuote[];
}

/**
 * 快照的分組。比 VenueKey 多一個 `origin`（產地價）——家禽交易行情給的是雞蛋與白肉雞的
 * **全國產地價**，不是批發市場的拍賣行情，資料來源與涵蓋的品項都不一樣。
 *
 * 一開始把它直接存成 `wholesale` 踩了坑：家禽那支一次回十六年的歷史（5,800 多天），
 * 於是「最近一份 wholesale 快照」會查到只含雞蛋跟白肉雞的那一份，所有蔬果的批發價整個
 * 消失。分開存、讀的時候再合併，兩種來源才不會互相覆蓋。
 */
type SnapshotScope = VenueKey | "origin" | "riceRetail" | "riceWholesale";

/**
 * 讀某個「場所」時要把哪幾份快照合起來。
 *
 * 每個來源都存成自己的 scope，不要寫進同一個 `${venue}:${date}`——`persist` 是用
 * replaceOne 寫的，兩個 builder 寫同一個 id 會互相覆蓋（產地價就是這樣把蔬果的批發價
 * 整份蓋掉過）。各存各的、讀的時候才合併，彼此不會踩到。
 */
/** 每個 scope 的資料在走勢（series）裡要歸到哪個場所。 */
const SERIES_VENUE_OF_SCOPE: Record<SnapshotScope, VenueKey> = {
  market: "market",
  super: "super",
  wholesale: "wholesale",
  origin: "wholesale",
  riceRetail: "market",
  riceWholesale: "wholesale",
};

const SCOPES_OF_VENUE: Record<VenueKey, SnapshotScope[]> = {
  market: ["market", "riceRetail"],
  wholesale: ["wholesale", "origin", "riceWholesale"],
  // 超市量販沒有任何來源，一律從零售推估（見 readQuote 的 fallback）。
  super: [],
};

interface SnapshotDoc {
  _id: string; // `${scope}:${date}`
  venue: SnapshotScope;
  date: string;
  byCode: Record<string, SnapshotEntry>;
  builtAt: Date;
}

interface SeriesStats {
  lowKg: number;
  highKg: number;
  avgKg: number;
  days: number;
}

interface SeriesDoc {
  _id: string; // `${venue}:${code}`
  venue: VenueKey;
  code: string;
  /** [日期, 元/公斤]。日期遞增。 */
  points: [string, number][];
  stats: SeriesStats;
  updatedAt: Date;
}

interface SyncMarkerDoc {
  _id: string;
  at: Date;
}

async function snapshots(): Promise<Collection<SnapshotDoc>> {
  return (await getDb()).collection<SnapshotDoc>("freshwise.snapshots");
}

async function seriesColl(): Promise<Collection<SeriesDoc>> {
  return (await getDb()).collection<SeriesDoc>("freshwise.series");
}

async function markers(): Promise<Collection<SyncMarkerDoc>> {
  return (await getDb()).collection<SyncMarkerDoc>("freshwise.syncMarkers");
}

/* ───────────────────── 聚合工具 ───────────────────── */

/**
 * 把多個市場的價格合成一個代表價。**兩種情況用兩種算法，這不是偷懶而是必要的：**
 *
 * - **有交易量（批發行情）→ 交易量加權平均。** 那才是「今天成交的菜平均多少錢」，而且
 *   加權本身就會壓低離群值的影響（某個市場一小批貨賣了怪價格，權重很小）。
 * - **沒有交易量（零售訪價、糧價）→ 中位數，不是算術平均。** 訪價是「每個市場記一個
 *   數字」，沒有權重可以參考，一筆填錯的資料會整個把平均拉走。實際遇過：臺中合作市場
 *   的香蕉標 100 元/台斤，同一天其他五個市場是 27～41——算術平均會變成 44，中位數是 34，
 *   後者才接近「你去市場大概付多少」。中位數也不需要我們去判斷那筆到底是錯誤還是真的
 *   有攤位賣那麼貴（分不出來，而且不必分）。
 */
function representativePrice(values: { value: number; weight?: number | null }[]): number {
  if (values.length === 0) return 0;

  // weight 可能是 null（Mongo 把 undefined 存成 null），所以檢查「是不是正數」，
  // 不要只比對 undefined。
  const weighted = values.filter((v) => typeof v.weight === "number" && v.weight > 0);
  if (weighted.length > 0) {
    const total = weighted.reduce((sum, v) => sum + (v.weight as number), 0);
    return weighted.reduce((sum, v) => sum + v.value * (v.weight as number), 0) / total;
  }

  const sorted = values.map((v) => v.value).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // 偶數筆取中間兩個的平均，奇數筆取正中間那個。
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 把各市場的成交量加起來。沒有任何市場有成交量（零售訪價）時回 null，不要回 0——
 *  0 看起來像「今天沒成交」，null 才是「這個來源沒有這個數字」。 */
function sumVolume(markets: MarketQuote[]): number | null {
  const total = markets.reduce((sum, m) => sum + (typeof m.volumeKg === "number" ? m.volumeKg : 0), 0);
  return total > 0 ? Math.round(total) : null;
}

/** 離群值判斷。基準價是目錄裡的 baseKg（批發價的量級），所以零售／超市要先換算回批發級。 */
function isOutlier(code: string, priceKg: number, venue: VenueKey): boolean {
  const item = findItem(code);
  if (!item || item.baseKg <= 0) return false;
  const expected = item.baseKg * VENUE_MULTIPLIER[venue];
  return priceKg > expected * OUTLIER_RATIO || priceKg < expected / OUTLIER_RATIO;
}

/* ───────────────────── 批發：從農業部的兩支 API 建快照 ───────────────────── */

interface RawMarketRow {
  marketCode: string;
  marketName: string;
  city: string;
  avgKg: number;
  highKg: number;
  /** 中價。批發行情有，零售訪價沒有。 */
  midKg?: number | null;
  lowKg: number;
  volumeKg?: number;
}

/** 把某一天的原始列（已經依品項過濾過）合併成一筆快照。同一個市場有多個品種時先合併
 *  成一列，再用各市場的交易量加權算出代表價。 */
function buildEntry(rows: RawMarketRow[], code: string, venue: VenueKey, source: PriceSource): SnapshotEntry | null {
  const withinRange = rows.filter((r) => r.avgKg > 0 && !isOutlier(code, r.avgKg, venue));
  const clean = dropMarketOutliers(withinRange);
  if (clean.length === 0) return null;

  const byMarket = new Map<string, RawMarketRow[]>();
  for (const row of clean) {
    const list = byMarket.get(row.marketCode) ?? [];
    list.push(row);
    byMarket.set(row.marketCode, list);
  }

  const markets: MarketQuote[] = [...byMarket.values()].map((list) => {
    const avgKg = round1(representativePrice(list.map((r) => ({ value: r.avgKg, weight: r.volumeKg }))));
    const volume = list.reduce((sum, r) => sum + (r.volumeKg ?? 0), 0);
    // 中價跟平均價一樣用代表價的算法合併（同一個市場可能有好幾個品種）；沒有中價的
    // 來源（零售訪價）就留 null，畫面上那一欄顯示「—」。
    const mids = list.filter((r) => typeof r.midKg === "number" && r.midKg > 0);
    return {
      marketCode: list[0].marketCode,
      marketName: list[0].marketName,
      city: list[0].city,
      avgKg,
      highKg: round1(Math.max(...list.map((r) => r.highKg))),
      midKg:
        mids.length > 0
          ? round1(representativePrice(mids.map((r) => ({ value: r.midKg as number, weight: r.volumeKg }))))
          : null,
      lowKg: round1(Math.min(...list.map((r) => r.lowKg))),
      volumeKg: volume > 0 ? Math.round(volume) : undefined,
    };
  });

  const avgKg = round1(representativePrice(markets.map((m) => ({ value: m.avgKg, weight: m.volumeKg }))));
  return {
    avgKg,
    highKg: round1(Math.max(...markets.map((m) => m.highKg))),
    lowKg: round1(Math.min(...markets.map((m) => m.lowKg))),
    source,
    markets,
  };
}

/**
 * 同一天、同一個品項，把跟「當天其他市場的中位數」差太多的那幾個市場丟掉。
 *
 * 為什麼需要這一層：`isOutlier` 比的是目錄裡寫死的基準價，容忍度必須放得很寬（青蔥真的
 * 會一天漲五倍），所以擋不掉「單一市場填錯一個位數」這種錯。實際看到過合作市場的香蕉
 * 標 100 元/台斤，而同一天其他五個市場是 27～41——那一筆把均價整個拉高。
 *
 * 用中位數而不是平均數當基準：離群值本身會把平均數拉過去，中位數不會。市場數少於四個
 * 時不做（三個數字的中位數太容易被一個錯誤值帶走，寧可留著）。
 */
function dropMarketOutliers(rows: RawMarketRow[]): RawMarketRow[] {
  if (rows.length < 4) return rows;
  const sorted = [...rows].map((r) => r.avgKg).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= 0) return rows;
  // 3 倍是刻意寬鬆的：同一天不同市場的價差本來就可能到兩倍（品質、規格差異），
  // 三倍以上才當成填錯。
  return rows.filter((r) => r.avgKg <= median * 3 && r.avgKg >= median / 3);
}

/** 市場代號／縣市：批發行情的回應本身就帶市場代號與名稱，縣市則從 catalog 的清單補
 *  （對不到就留空字串，畫面上那一欄就不顯示）。 */
const WHOLESALE_CITY = new Map(marketsOfVenue("wholesale").map((m) => [m.name, m.city]));

async function buildWholesaleSnapshots(startISO: string, endISO: string): Promise<SnapshotDoc[]> {
  const settled = diffDays(endISO, todayISO()) > 2;
  const [farm, aquatic] = await Promise.all([
    fetchFarmRows(startISO, endISO, settled),
    fetchAquaticRows(startISO, endISO, settled),
  ]);

  // 先把「哪個品項要哪些列」整理好，避免對每個品項都掃一次全部資料（九十幾個品項
  // × 兩萬列會掃到兩百萬次字串比對）。
  const farmByDate = new Map<string, Map<string, RawMarketRow[]>>();
  for (const row of farm) {
    // 原始資料裡真的會出現作物名稱是 null 的列（實際踩過，整支同步就掛在這裡）。
    // 開放資料的每個欄位都要當成「可能是 null 或型別不對」來處理，不能相信文件。
    const name = typeof row.作物名稱 === "string" ? row.作物名稱 : "";
    const marketName = typeof row.市場名稱 === "string" ? row.市場名稱 : "";
    if (!name || !marketName) continue;
    const date = rocToISO(String(row.交易日期 ?? ""));
    if (!date) continue;
    const avgKg = toPositiveNumber(row.平均價);
    if (avgKg === null) continue;

    for (const [code, ref] of Object.entries(SOURCE_MAP)) {
      if (!ref.farm || !matchesName(name, ref.farm)) continue;
      const perDate = farmByDate.get(date) ?? new Map<string, RawMarketRow[]>();
      const list = perDate.get(code) ?? [];
      list.push({
        marketCode: String(row.市場代號 ?? marketName),
        marketName,
        city: WHOLESALE_CITY.get(marketName) ?? "",
        avgKg,
        highKg: toPositiveNumber(row.上價) ?? avgKg,
        midKg: toPositiveNumber(row.中價),
        lowKg: toPositiveNumber(row.下價) ?? avgKg,
        volumeKg: toPositiveNumber(row.交易量) ?? undefined,
      });
      perDate.set(code, list);
      farmByDate.set(date, perDate);
    }
  }

  for (const row of aquatic) {
    const name = typeof row.魚貨名稱 === "string" ? row.魚貨名稱 : "";
    const marketName = typeof row.市場名稱 === "string" ? row.市場名稱 : "";
    if (!name || !marketName) continue;
    const date = rocToISO(String(row.交易日期 ?? ""));
    if (!date) continue;
    const avgKg = toPositiveNumber(row.平均價);
    if (avgKg === null) continue;

    for (const [code, ref] of Object.entries(SOURCE_MAP)) {
      if (!ref.aquatic || !matchesName(name, ref.aquatic)) continue;
      const perDate = farmByDate.get(date) ?? new Map<string, RawMarketRow[]>();
      const list = perDate.get(code) ?? [];
      list.push({
        // 漁產品的回應沒有市場代號，只有市場名稱——用名稱當代號（市場選擇器也是用這個
        // 清單產生的，所以前後一致）。
        marketCode: `AQ-${marketName}`,
        marketName,
        city: "",
        avgKg,
        highKg: toPositiveNumber(row.上價) ?? avgKg,
        midKg: toPositiveNumber(row.中價),
        lowKg: toPositiveNumber(row.下價) ?? avgKg,
        volumeKg: toPositiveNumber(row.交易量) ?? undefined,
      });
      perDate.set(code, list);
      farmByDate.set(date, perDate);
    }
  }

  const docs: SnapshotDoc[] = [];
  for (const [date, perCode] of farmByDate) {
    const byCode: Record<string, SnapshotEntry> = {};
    for (const [code, rows] of perCode) {
      const entry = buildEntry(rows, code, "wholesale", "wholesale");
      if (entry) byCode[code] = entry;
    }
    if (Object.keys(byCode).length > 0) {
      docs.push({ _id: `wholesale:${date}`, venue: "wholesale", date, byCode, builtAt: new Date() });
    }
  }
  return docs;
}

/* ───────────────────── 零售：從臺中那份檔案建快照 ───────────────────── */

const TAICHUNG_CITY = "臺中市";

async function buildRetailSnapshots(): Promise<SnapshotDoc[]> {
  const rows = await fetchTaichungRetail();

  // 欄位名稱 → 品項代碼的反查表（一個欄位只會屬於一個品項）。
  const columnToCode = new Map<string, string>();
  for (const [code, ref] of Object.entries(SOURCE_MAP)) {
    for (const column of ref.taichung ?? []) columnToCode.set(column, code);
  }

  const byDate = new Map<string, Map<string, RawMarketRow[]>>();
  for (const row of rows) {
    const date = adToISO(String(row.訪價日期 ?? ""));
    if (!date) continue;
    const marketName = String(row.市場名稱 ?? "").trim();
    if (!marketName || isClosedMarket(marketName)) continue;

    for (const [column, raw] of Object.entries(row)) {
      if (column === "市場名稱" || column === "訪價日期") continue;
      const code = columnToCode.get(column);
      if (!code) continue;
      // 元/台斤 → 元/公斤。缺價是字串 "0"，toPositiveNumber 會回 null。
      const perCatty = toPositiveNumber(raw);
      if (perCatty === null) continue;
      const avgKg = perCatty / KG_PER_CATTY;

      const perCode = byDate.get(date) ?? new Map<string, RawMarketRow[]>();
      const list = perCode.get(code) ?? [];
      list.push({
        marketCode: `TC-${marketName}`,
        marketName,
        city: TAICHUNG_CITY,
        avgKg,
        highKg: avgKg,
        lowKg: avgKg,
      });
      perCode.set(code, list);
      byDate.set(date, perCode);
    }
  }

  const docs: SnapshotDoc[] = [];
  for (const [date, perCode] of byDate) {
    const byCode: Record<string, SnapshotEntry> = {};
    for (const [code, list] of perCode) {
      const entry = buildEntry(list, code, "market", "retail");
      if (entry) byCode[code] = entry;
    }
    if (Object.keys(byCode).length > 0) {
      docs.push({ _id: `market:${date}`, venue: "market", date, byCode, builtAt: new Date() });
    }
  }
  return docs;
}

/* ───────────────────── 糧價（米）───────────────────── */

/**
 * 糧價 → 零售與批發兩份快照。
 *
 * 這是唯一一份**全國各縣市、每天更新的零售價**，所以米不受「零售只有臺中」那個限制。
 * 一支請求就回約一年半的歷史（20 縣市 × 約 500 天），走勢與划算度一開始就是滿的。
 *
 * 單位：零售欄位是元/公斤（直接用）、批發欄位是元/100 公斤（要除以 100）。
 */
async function buildRiceSnapshots(): Promise<SnapshotDoc[]> {
  const rows = await fetchRiceRows();
  const cutoff = addDays(todayISO(), -MAX_HISTORY_DAYS);

  /** date → scope → code → 各縣市的列 */
  const byDate = new Map<string, Map<"riceRetail" | "riceWholesale", Map<string, RawMarketRow[]>>>();

  for (const row of rows) {
    const date = rocToISO(String(row.pt_date_day ?? ""));
    if (!date || date < cutoff) continue;
    const cityCode = String(row.CityName ?? "");
    const cityName = RICE_CITIES[cityCode];
    // 對不到名稱的縣市代碼就跳過——寧可少一個縣市，也不要在畫面上顯示一串數字當市場名。
    if (!cityName) continue;

    for (const [code, ref] of Object.entries(SOURCE_MAP)) {
      if (!ref.rice) continue;
      const retail = toPositiveNumber(row[`pt_1${ref.rice}_price`]);
      const wholesalePer100 = toPositiveNumber(row[`pt_2${ref.rice}_price`]);

      const scopes = byDate.get(date) ?? new Map();
      const push = (scope: "riceRetail" | "riceWholesale", avgKg: number) => {
        const perCode = scopes.get(scope) ?? new Map<string, RawMarketRow[]>();
        const list = perCode.get(code) ?? [];
        list.push({
          marketCode: `RC-${cityCode}`,
          marketName: cityName,
          city: cityName,
          avgKg,
          highKg: avgKg,
          lowKg: avgKg,
        });
        perCode.set(code, list);
        scopes.set(scope, perCode);
      };

      if (retail !== null) push("riceRetail", retail);
      if (wholesalePer100 !== null) push("riceWholesale", wholesalePer100 / 100);
      byDate.set(date, scopes);
    }
  }

  const docs: SnapshotDoc[] = [];
  for (const [date, scopes] of byDate) {
    for (const [scope, perCode] of scopes) {
      const byCode: Record<string, SnapshotEntry> = {};
      for (const [code, list] of perCode) {
        const entry = buildEntry(list, code, scope === "riceRetail" ? "market" : "wholesale", "grain");
        if (entry) byCode[code] = entry;
      }
      if (Object.keys(byCode).length > 0) {
        docs.push({ _id: `${scope}:${date}`, venue: scope, date, byCode, builtAt: new Date() });
      }
    }
  }
  return docs;
}

/* ───────────────────── 產銷履歷與有機 ───────────────────── */

interface TracedDoc {
  _id: string; // date
  date: string;
  byCode: Record<string, { certifiedKg: number; plainKg: number; certifiedShare: number }>;
  builtAt: Date;
}

async function tracedColl(): Promise<Collection<TracedDoc>> {
  return (await getDb()).collection<TracedDoc>("freshwise.traced");
}

/**
 * 產銷履歷與有機蔬果行情 → 「有標章 vs 一般」的單價比較。
 *
 * 來源只給交易金額與交易量，單價要自己用「金額 ÷ 量」算——那剛好就是成交加權平均，
 * 比挑某一筆更有代表性。`溯源代號` 是 `X` 的算「一般」，其他代號全部算「有標章」
 * （代碼表沒公開，分不出是有機還是產銷履歷，所以不宣稱種類）。
 *
 * 兩邊都要有成交才有比較的意義，只有一邊的那天就不寫。
 */
async function buildTracedPrices(dateISO: string): Promise<TracedDoc[]> {
  // **一天一個請求。** 這支跟農產品那支一樣「查區間就慢得不可接受」：實測單日查詢
  // 6～12 秒、三天的查詢 37 秒（會撞到請求逾時）。而標章比較只需要最新一天的數字、
  // 不畫走勢，所以一天一天查剛好。
  const settled = diffDays(dateISO, todayISO()) > 2;
  const rows = await fetchTracedRows(dateISO, dateISO, settled);

  /** date → code → { certified: [金額, 量], plain: [金額, 量] } */
  const acc = new Map<string, Map<string, { c: [number, number]; p: [number, number] }>>();

  for (const row of rows) {
    const name = typeof row.作物名稱 === "string" ? row.作物名稱 : "";
    if (!name) continue;
    // **這一支的交易日期是西元 `20261120`，不是民國**（同一個平台第四種日期格式）。
    // 先試西元再退回民國：八位數字只可能是西元，民國那種是七位，不會互相誤判。
    // 搞錯方向的話 2026 會被再加 1911 變成 3937 年，而且不會報錯——那段資料會因為
    // 「日期在未來」而永遠查不到，畫面上只是那一區塊不出現。
    const raw = String(row.交易日期 ?? "");
    const date = adToISO(raw) ?? rocToISO(raw);
    if (!date) continue;
    const amount = toPositiveNumber(row.交易金額_元);
    const volume = toPositiveNumber(row.交易量_公斤);
    if (amount === null || volume === null) continue;
    const certified = String(row.溯源代號 ?? "X").toUpperCase() !== "X";

    for (const [code, ref] of Object.entries(SOURCE_MAP)) {
      if (!ref.farm || !matchesName(name, ref.farm)) continue;
      const perCode = acc.get(date) ?? new Map();
      const cell = perCode.get(code) ?? { c: [0, 0] as [number, number], p: [0, 0] as [number, number] };
      const target = certified ? cell.c : cell.p;
      target[0] += amount;
      target[1] += volume;
      perCode.set(code, cell);
      acc.set(date, perCode);
    }
  }

  const docs: TracedDoc[] = [];
  for (const [date, perCode] of acc) {
    const byCode: TracedDoc["byCode"] = {};
    for (const [code, cell] of perCode) {
      if (cell.c[1] <= 0 || cell.p[1] <= 0) continue;
      const certifiedKg = round1(cell.c[0] / cell.c[1]);
      const plainKg = round1(cell.p[0] / cell.p[1]);
      if (isOutlier(code, certifiedKg, "wholesale") || isOutlier(code, plainKg, "wholesale")) continue;
      byCode[code] = {
        certifiedKg,
        plainKg,
        certifiedShare: Math.round((cell.c[1] / (cell.c[1] + cell.p[1])) * 100),
      };
    }
    if (Object.keys(byCode).length > 0) docs.push({ _id: date, date, byCode, builtAt: new Date() });
  }
  return docs;
}

async function persistTraced(docs: TracedDoc[]): Promise<void> {
  if (docs.length === 0) return;
  const coll = await tracedColl();
  await coll.bulkWrite(
    docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
    { ordered: false },
  );
}

/* ───────────────────── 產地價（雞蛋、白肉雞）───────────────────── */

async function buildOriginSnapshots(): Promise<SnapshotDoc[]> {
  const rows = await fetchPoultryRows();
  const docs: SnapshotDoc[] = [];
  // 家禽那支沒有日期參數，一次回十六年（5,800 多筆）。只留近一年多——再舊的資料對
  // 「今天該不該買蛋」沒有幫助，全部寫進去只是多幾千份用不到的快照。
  const cutoff = addDays(todayISO(), -MAX_HISTORY_DAYS);

  for (const row of rows) {
    const date = adToISO(String(row.日期 ?? ""));
    if (!date || date < cutoff) continue;
    const byCode: Record<string, SnapshotEntry> = {};

    for (const [code, ref] of Object.entries(SOURCE_MAP)) {
      if (!ref.poultry) continue;
      const perCatty = toPositiveNumber(row[ref.poultry]);
      if (perCatty === null) continue;
      const avgKg = round1(perCatty / KG_PER_CATTY);
      byCode[code] = {
        avgKg,
        highKg: avgKg,
        lowKg: avgKg,
        source: "origin",
        // 產地價是全國一個數字，沒有分市場。
        markets: [{ marketCode: "ORIGIN", marketName: "全國產地價", city: "", avgKg, highKg: avgKg, lowKg: avgKg }],
      };
    }
    if (Object.keys(byCode).length > 0) {
      docs.push({ _id: `origin:${date}`, venue: "origin", date, byCode, builtAt: new Date() });
    }
  }
  return docs;
}

/* ───────────────────── 寫入與更新 ───────────────────── */

function statsOfPoints(points: [string, number][]): SeriesStats {
  if (points.length === 0) return { lowKg: 0, highKg: 0, avgKg: 0, days: 0 };
  const values = points.map((p) => p[1]);
  return {
    lowKg: round1(Math.min(...values)),
    highKg: round1(Math.max(...values)),
    avgKg: round1(values.reduce((a, b) => a + b, 0) / values.length),
    days: values.length,
  };
}

/** 把一批快照寫進資料庫，同時把每個品項的走勢（series）更新。 */
async function persist(docs: SnapshotDoc[]): Promise<void> {
  if (docs.length === 0) return;
  const snaps = await snapshots();
  const series = await seriesColl();

  await snaps.bulkWrite(
    docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
    { ordered: false },
  );

  // 收集每個 (場所, 品項) 這批新增的點。走勢是按「使用者看到的場所」存的，所以輔助來源
  // 要先折回它所屬的場所——產地價與米的批發價都歸到 wholesale、米的零售價歸到 market。
  // 對使用者來說「批發行情」那一欄顯示的就是雞蛋的產地價、米的批發價，走勢圖該是同一條線。
  const incoming = new Map<string, Map<string, number>>();
  for (const doc of docs) {
    const seriesVenue = SERIES_VENUE_OF_SCOPE[doc.venue];
    // 對不到場所的 scope 就跳過。寫出去的話會變成一條永遠不會被讀到的走勢（讀取端只查
    // `${venue}:${code}`），資料看起來有、畫面上卻是空的——這種「孤兒資料」很難發現。
    if (!seriesVenue) continue;
    for (const [code, entry] of Object.entries(doc.byCode)) {
      const key = `${seriesVenue}:${code}`;
      const perDate = incoming.get(key) ?? new Map<string, number>();
      perDate.set(doc.date, entry.avgKg);
      incoming.set(key, perDate);
    }
  }
  if (incoming.size === 0) return;

  const existing = await series.find({ _id: { $in: [...incoming.keys()] } }).toArray();
  const existingById = new Map(existing.map((d) => [d._id, d]));
  const cutoff = addDays(todayISO(), -MAX_HISTORY_DAYS);

  const writes = [...incoming.entries()].map(([key, perDate]) => {
    const [venue, code] = key.split(":") as [VenueKey, string];
    const merged = new Map(existingById.get(key)?.points ?? []);
    for (const [date, price] of perDate) merged.set(date, price);

    const points = [...merged.entries()]
      .filter(([date]) => date >= cutoff)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)) as [string, number][];

    const doc: SeriesDoc = { _id: key, venue, code, points, stats: statsOfPoints(points), updatedAt: new Date() };
    return { replaceOne: { filter: { _id: key }, replacement: doc, upsert: true } };
  });

  await series.bulkWrite(writes, { ordered: false });
}

/** 清掉太舊的快照。快照只被用來讀「最近一份」與「前一份」，歷史在 series 裡；留一年多
 *  是為了需要時能從快照重建 series，再更舊的就只是占空間。 */
async function pruneSnapshots(): Promise<void> {
  const coll = await snapshots();
  await coll.deleteMany({ date: { $lt: addDays(todayISO(), -MAX_HISTORY_DAYS) } }).catch(() => {});
}

/** 標記某個同步動作做過了，避免同一個請求週期內重複抓同一份大檔。 */
async function shouldRun(marker: string, maxAgeMs: number): Promise<boolean> {
  const coll = await markers();
  const doc = await coll.findOne({ _id: marker });
  return !doc || Date.now() - doc.at.getTime() > maxAgeMs;
}

async function markRan(marker: string): Promise<void> {
  const coll = await markers();
  await coll.updateOne({ _id: marker }, { $set: { at: new Date() } }, { upsert: true });
}

/** 同步失敗時把標記清掉，下一次請求才會重試（不然要等整個 TTL 過完才會再試一次）。 */
async function clearMark(marker: string): Promise<void> {
  const coll = await markers();
  await coll.deleteOne({ _id: marker }).catch(() => {});
}

/**
 * 跑一個同步任務。**標記在開始之前就寫**，不是做完才寫——正式環境是 serverless，同一
 * 時間可能有好幾個請求進來，標記寫在後面的話它們會各自判定「該同步了」然後同時去抓同一
 * 份 5MB 的檔案。先寫標記等於一個很粗但夠用的鎖；失敗再把標記清掉讓下一次重試。
 */
async function runSync(marker: string, maxAgeMs: number, work: () => Promise<void>): Promise<void> {
  if (!(await shouldRun(marker, maxAgeMs))) return;
  await markRan(marker);
  try {
    await work();
  } catch (error) {
    await clearMark(marker);
    console.warn(`[freshwise] ${marker} 同步失敗：`, error);
  }
}

/**
 * 確保資料是新的。頁面算繪時會呼叫，所以**必須便宜**：
 * - 批發：只補最近 RECENT_DAYS 天（兩三次分頁請求），而且四小時內只做一次。
 * - 零售：臺中那份一次就有一年，六小時內只做一次。
 * - 產地價：一支小 API，六小時一次。
 *
 * 任何一個來源失敗都不會讓整頁壞掉——有舊資料就用舊的，畫面上會顯示資料日期。
 */
export async function ensureFresh(): Promise<void> {
  await Promise.all([
    runSync("wholesale", 4 * 60 * 60 * 1000, async () => {
      const end = todayISO();
      await persist(await buildWholesaleSnapshots(addDays(end, -(RECENT_DAYS - 1)), end));
    }),
    runSync("rice", 6 * 60 * 60 * 1000, async () => {
      await persist(await buildRiceSnapshots());
    }),
    runSync("traced", 6 * 60 * 60 * 1000, async () => {
      // 從今天往回找，第一天有資料就停。那五個市場週一休市、當天的資料也常常晚上才上來，
      // 所以不能只查今天；但也不用抓一整段（見 buildTracedPrices 的說明）。
      const end = todayISO();
      for (let back = 0; back < 4; back++) {
        const docs = await buildTracedPrices(addDays(end, -back));
        if (docs.length > 0) {
          await persistTraced(docs);
          return;
        }
      }
    }),
    runSync("retail", 6 * 60 * 60 * 1000, async () => {
      await persist(await buildRetailSnapshots());
    }),
    runSync("origin", 6 * 60 * 60 * 1000, async () => {
      await persist(await buildOriginSnapshots());
      await pruneSnapshots();
    }),
  ]);
}

/**
 * 頁面要資料時走這一支，不要直接 await ensureFresh()。
 *
 * **已經有資料的時候絕對不要讓使用者等外部 API。** 一次完整的同步要抓臺中那份 5MB 的
 * 檔案加上農業部的幾支 API，實測約 20 秒——正式環境是 Vercel 的 serverless function，
 * 那會直接撞到執行時間上限，變成使用者看到 504。而且那段等待完全沒必要：資料庫裡已經
 * 有今天（或最近一天）的快照可以先回答。
 *
 * 所以分兩種情況：
 * - **有資料**：立刻用現有的快照回應，同步排到回應送出之後才跑（Next.js 的 `after`）。
 *   使用者這一次看到的可能是幾小時前抓的資料（畫面上本來就會標資料日期），下一個人就
 *   會拿到更新後的。
 * - **完全沒有資料**（第一次部署、或資料庫被清掉）：只能等，不然畫面是空的。
 *
 * `after` 只能在請求情境裡用，所以 scripts/freshwise-sync.mts 那種 standalone 腳本呼叫
 * 時會落到 catch，那邊本來就是直接 await ensureFresh()，不走這一支。
 */
async function refreshInBackground(hasData: boolean): Promise<void> {
  if (!hasData) {
    await ensureFresh();
    return;
  }
  try {
    const { after } = await import("next/server");
    after(() => ensureFresh());
  } catch {
    // 不在請求情境（例如腳本直接呼叫 getPriceBook）就什麼都不做——那種情況下資料已經
    // 夠用了，而且腳本自己會呼叫 ensureFresh。
  }
}

/**
 * 補批發行情的歷史。只給 scripts/freshwise-sync.mts 與排程用，**頁面絕對不要呼叫**。
 *
 * **一天一個請求，不是一次查一個區間。** 這是實測出來的：農業部那支查多天會慢到無法
 * 接受——查 5 天一個區間、連續補 45 天（9 次請求）實際跑了兩小時還沒結束，最後還因為
 * 連續寫入大量資料把 Mongo 連線寫爆（ECONNRESET）。改成一天一個請求之後，每次回應約
 * 3,200 筆、幾秒鐘就回來，而且失敗只影響那一天。
 *
 * 即使如此，補一個月還是要好幾分鐘，所以這支的定位是「偶爾手動跑一次的暖機」或排程，
 * 不是使用者等得起的操作。日常的歷史累積靠排程每天跑一次就好。
 */
export async function backfillWholesale(days: number, onProgress?: (msg: string) => void): Promise<number> {
  const end = todayISO();
  let written = 0;
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(end, -offset);
    // 週一批發市場休市，整天沒有任何一列，不用浪費一次請求。
    if (weekdayOf(date) === 1) continue;

    const existing = await (await snapshots()).findOne({ _id: `wholesale:${date}` }, { projection: { _id: 1 } });
    if (existing) {
      onProgress?.(`${date} 已經有了，跳過`);
      continue;
    }

    try {
      const docs = await buildWholesaleSnapshots(date, date);
      await persist(docs);
      written += docs.length;
      onProgress?.(`${date} 寫入 ${docs.length} 份`);
    } catch (error) {
      // 一天失敗不要讓整段中斷——下次再跑會從缺的那天繼續（上面會跳過已經有的）。
      onProgress?.(`${date} 失敗：${(error as Error).message}`);
    }
  }
  return written;
}

export async function syncAll(onProgress?: (msg: string) => void): Promise<{ retail: number; origin: number }> {
  onProgress?.("臺中零售（一次就有一年）");
  const retailDocs = await buildRetailSnapshots();
  await persist(retailDocs);
  await markRan("retail");

  onProgress?.("產地價");
  const originDocs = await buildOriginSnapshots();
  await persist(originDocs);
  await markRan("origin");

  return { retail: retailDocs.length, origin: originDocs.length };
}

/* ───────────────────── 讀取：組出 PriceQuote ───────────────────── */

/** 某個分組在指定日期（或之前）最近的一份快照。null 代表完全沒有資料。 */
async function latestSnapshot(scope: SnapshotScope, onOrBefore: string): Promise<SnapshotDoc | null> {
  const coll = await snapshots();
  return coll.findOne({ venue: scope, date: { $lte: onOrBefore } }, { sort: { date: -1 } });
}

async function snapshotBefore(scope: SnapshotScope, before: string): Promise<SnapshotDoc | null> {
  const coll = await snapshots();
  return coll.findOne({ venue: scope, date: { $lt: before } }, { sort: { date: -1 } });
}

/**
 * 把同一個場所的幾份快照合成一份。
 *
 * 各來源的日期不一定相同（家禽行情常常比批發市場早一天、糧價又是另一條線），所以日期
 * 取最新的那一個，品項則各自補上。**前面的來源優先**：同一個品項兩邊都有的時候，排在
 * 前面的那一份勝出（例如白肉雞批發市場與產地價都有，批發市場的成交行情比較接近消費者）。
 */
function mergeSnapshots(docs: (SnapshotDoc | null)[]): SnapshotDoc | null {
  const present = docs.filter((doc): doc is SnapshotDoc => !!doc);
  if (present.length === 0) return null;
  if (present.length === 1) return present[0];

  const byCode: Record<string, SnapshotEntry> = {};
  // 從後往前疊，前面的來源就會覆蓋後面的。
  for (const doc of [...present].reverse()) Object.assign(byCode, doc.byCode);

  return {
    ...present[0],
    date: present.reduce((latest, doc) => (doc.date > latest ? doc.date : latest), present[0].date),
    byCode,
  };
}

/** 從一份快照裡把出現過的市場收集起來。 */
function marketOptionsOf(snap: SnapshotDoc | null): MarketOption[] {
  if (!snap) return [];
  const seen = new Map<string, MarketOption>();
  for (const entry of Object.values(snap.byCode)) {
    for (const market of entry.markets) {
      if (market.marketCode === "ORIGIN" || seen.has(market.marketCode)) continue;
      seen.set(market.marketCode, {
        code: market.marketCode,
        name: market.marketName,
        city: market.city,
        group: market.marketCode.startsWith("AQ-")
          ? "魚市場"
          : market.marketCode.startsWith("TC-")
            ? "臺中市公有零售市場"
            : market.marketCode.startsWith("RC-")
              ? "各縣市糧價（米）"
              : "蔬果批發市場",
      });
    }
  }
  return [...seen.values()].sort((a, b) => (a.group === b.group ? a.name.localeCompare(b.name, "zh-TW") : a.group < b.group ? -1 : 1));
}

interface ReadContext {
  retail: SnapshotDoc | null;
  retailPrev: SnapshotDoc | null;
  wholesale: SnapshotDoc | null;
  wholesalePrev: SnapshotDoc | null;
  stats: Map<string, SeriesStats>;
  /** 每個分類「零售 ÷ 批發」的實際倍數區間，從當天同時有兩種價格的品項回推出來。 */
  ratios: Map<CategoryKey, { low: number; high: number }>;
}

/**
 * 回推每個分類的「零售 ÷ 批發」倍數區間。
 *
 * 用當天**同時有零售訪價與批發行情**的品項算：每一項算出自己的倍數，再取同分類的
 * 最小值與最大值。臺中有訪價的品項約四十個，分散在各分類，足以當成同分類其他品項的
 * 參考範圍。
 *
 * 為什麼要即時算、不寫死：倍數會隨季節與行情變（產季時批發價跌得比零售快，倍數就放大）。
 * 寫死一組數字過一季就不準了。算不出來（例如零售資料整批缺）才退回 catalog.ts 的
 * ESTIMATE_RANGE。
 *
 * **用四分位距（P25～P75）而不是最小值／最大值。** 一開始取 min/max，結果青椒的區間是
 * 「34～141 元/台斤」——四倍寬的區間對使用者毫無幫助，它只是告訴他「我們不知道」。
 * 四分位距代表「一般情況落在哪裡」，會窄得多（同一項變成 43～68），而且仍然誠實：
 * 它不宣稱精確，只是不再被一兩個極端值撐開。
 */
function estimateRatios(retail: SnapshotDoc | null, wholesale: SnapshotDoc | null): Map<CategoryKey, { low: number; high: number }> {
  const result = new Map<CategoryKey, { low: number; high: number }>();
  if (!retail || !wholesale) return result;

  const byCategory = new Map<CategoryKey, number[]>();
  for (const [code, retailEntry] of Object.entries(retail.byCode)) {
    const wholesaleEntry = wholesale.byCode[code];
    const item = findItem(code);
    if (!wholesaleEntry || !item || wholesaleEntry.avgKg <= 0 || retailEntry.avgKg <= 0) continue;
    const ratio = retailEntry.avgKg / wholesaleEntry.avgKg;
    // 倍數小於 1（零售比批發便宜）一定是資料有問題，不要讓它污染區間。
    if (ratio < 1 || ratio > 8) continue;
    const list = byCategory.get(item.category) ?? [];
    list.push(ratio);
    byCategory.set(item.category, list);
  }

  for (const [category, ratios] of byCategory) {
    // 至少要三個樣本才敢拿來推估別的品項，不然一兩個特例會決定整個分類的範圍。
    if (ratios.length < 3) continue;
    const sorted = [...ratios].sort((a, b) => a - b);
    result.set(category, {
      low: Math.round(percentile(sorted, 0.25) * 10) / 10,
      high: Math.round(percentile(sorted, 0.75) * 10) / 10,
    });
  }
  return result;
}

/** 排序好的陣列取第 p 分位（線性插值）。樣本很少時四分位會退化成接近中位數，
 *  那是可接受的——樣本少的時候本來就不該給很寬的區間。 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

async function loadContext(todayDate: string, codes: string[]): Promise<ReadContext> {
  /** 一個場所要讀的幾份快照（今天那份與前一份）。 */
  async function load(venue: VenueKey) {
    const scopes = SCOPES_OF_VENUE[venue];
    const latest = await Promise.all(scopes.map((scope) => latestSnapshot(scope, todayDate)));
    const prev = await Promise.all(
      latest.map((doc, i) => (doc ? snapshotBefore(scopes[i], doc.date) : Promise.resolve(null))),
    );
    return { now: mergeSnapshots(latest), before: mergeSnapshots(prev) };
  }

  const [marketSnaps, wholesaleSnaps] = await Promise.all([load("market"), load("wholesale")]);
  const retail = marketSnaps.now;
  const retailPrev = marketSnaps.before;
  const wholesale = wholesaleSnaps.now;
  const wholesalePrev = wholesaleSnaps.before;

  // 統計只讀 stats，不讀 points——清單頁一次要九十幾個品項，把一年的點都搬回來會是
  // 幾百 KB，而畫面上只用到最低／最高／平均／天數四個數字。
  const keys = codes.flatMap((code) => [`market:${code}`, `wholesale:${code}`]);
  const docs = await (await seriesColl())
    .find({ _id: { $in: keys } }, { projection: { points: 0 } })
    .toArray();

  return {
    retail,
    retailPrev,
    wholesale,
    wholesalePrev,
    stats: new Map(docs.map((d) => [d._id, d.stats])),
    ratios: estimateRatios(retail, wholesale),
  };
}

/**
 * 組出某品項在某場所的報價。找不到實際資料時往回退：
 *   超市量販 ← 零售 × 1.25 ← 批發 × 2.25
 *   傳統市場 ← 批發 × 1.8
 * 退過的都標 `estimated`，並把 source 設成 `derived`。
 *
 * 三個場所都沒有資料就回 null（例如肉類沒有任何批發來源、產季外的水果整段沒有行情）。
 */
function readQuote(
  code: string,
  venue: VenueKey,
  ctx: ReadContext,
  marketCode: string,
  withMarkets: boolean,
): PriceQuote | null {
  const ref = sourceOf(code);
  if (!ref) return null;

  /** 從一份快照取某品項的 entry（指定市場時只取那個市場）。 */
  function pick(snap: SnapshotDoc | null): { entry: SnapshotEntry; date: string } | null {
    const entry = snap?.byCode[code];
    if (!snap || !entry) return null;
    if (!marketCode) return { entry, date: snap.date };
    const market = entry.markets.find((m) => m.marketCode === marketCode);
    if (!market) return null;
    return {
      entry: { avgKg: market.avgKg, highKg: market.highKg, lowKg: market.lowKg, markets: [market] },
      date: snap.date,
    };
  }

  // 來源以快照自己記的為準（同一個場所裡不同品項可能來自不同來源），舊資料沒記的話
  // 才退回按場所猜。
  const direct: { venue: VenueKey; fallbackSource: PriceSource } | null =
    venue === "market"
      ? { venue: "market", fallbackSource: "retail" }
      : venue === "wholesale"
        ? { venue: "wholesale", fallbackSource: ref.poultry ? "origin" : "wholesale" }
        : null;

  // 1. 這個場所本身有資料嗎
  if (direct) {
    const snap = direct.venue === "market" ? ctx.retail : ctx.wholesale;
    const prevSnap = direct.venue === "market" ? ctx.retailPrev : ctx.wholesalePrev;
    const hit = pick(snap);
    if (hit) {
      const stats = ctx.stats.get(`${direct.venue}:${code}`);
      const prev = pick(prevSnap);
      return {
        code,
        date: hit.date,
        venue,
        avgKg: hit.entry.avgKg,
        prevKg: prev?.entry.avgKg ?? null,
        yearLowKg: stats?.lowKg ?? hit.entry.avgKg,
        yearHighKg: stats?.highKg ?? hit.entry.avgKg,
        yearAvgKg: stats?.avgKg ?? hit.entry.avgKg,
        source: hit.entry.source ?? direct.fallbackSource,
        estimated: false,
        historyDays: stats?.days ?? 1,
        // 總成交量跟著報價走（不只放在市場明細裡），清單頁才能按成交量排序。
        volumeKg: sumVolume(hit.entry.markets),
        markets: withMarkets ? hit.entry.markets : [],
      };
    }
  }

  // 2. 沒有實測價：從別的場所推估，而且**給一個區間，不給一個假的精確數字**。
  //
  //    傳統市場 ← 批發 × 該分類實際觀察到的倍數區間
  //    超市／大賣場 ← 傳統市場（實測或推估）× 一般認知的 1.1～1.35 倍
  //
  //    倍數區間的來歷見 estimateRatios 與 catalog.ts 的 ESTIMATE_RANGE：實測回推發現
  //    「零售 ÷ 批發」在 1.2～4.5 倍之間，用單一係數套會錯到讓人買錯。
  const item = findItem(code);
  if (!item) return null;
  const categoryRange = ctx.ratios.get(item.category) ?? ESTIMATE_RANGE[item.category];

  /** 把一筆基準報價乘上倍數區間，變成一筆推估報價。 */
  function estimateFrom(base: PriceQuote, range: { low: number; high: number }): PriceQuote {
    const mid = (range.low + range.high) / 2;
    return {
      code,
      date: base.date,
      venue,
      // 區間的中點當代表值：排序、漲跌、划算度都要一個單一數字才算得下去。
      avgKg: round1(base.avgKg * mid),
      rangeLowKg: round1(base.avgKg * range.low),
      rangeHighKg: round1(base.avgKg * range.high),
      prevKg: base.prevKg === null ? null : round1(base.prevKg * mid),
      yearLowKg: round1(base.yearLowKg * mid),
      yearHighKg: round1(base.yearHighKg * mid),
      yearAvgKg: round1(base.yearAvgKg * mid),
      source: "derived",
      estimated: true,
      historyDays: base.historyDays,
      // 成交量是批發市場的事實，推估的零售價不該帶著它——那會讓人以為這個價格有那麼多
      // 成交量支撐。
      volumeKg: null,
      // 推估值沒有「各市場明細」可言——那是別的場所的市場。
      markets: [],
    };
  }

  if (venue === "market") {
    // 傳統市場沒有實測 → 從批發推估。
    const base = readQuote(code, "wholesale", ctx, "", false);
    return base ? estimateFrom(base, categoryRange) : null;
  }

  if (venue === "super") {
    // 超市一律從傳統市場推估（傳統市場本身可能也是推估的，區間會疊起來）。
    const base = readQuote(code, "market", ctx, "", false);
    if (!base) return null;
    const estimate = estimateFrom(base, SUPER_OVER_MARKET);
    // 基準本身就是區間的話，區間要疊上去，不是只乘中點。
    if (base.rangeLowKg !== undefined && base.rangeHighKg !== undefined) {
      estimate.rangeLowKg = round1(base.rangeLowKg * SUPER_OVER_MARKET.low);
      estimate.rangeHighKg = round1(base.rangeHighKg * SUPER_OVER_MARKET.high);
    }
    return estimate;
  }

  return null;
}

/** 清單頁用：一次把整份目錄在這個場所的報價組好（不含各市場明細，省傳輸量）。 */
export async function getPriceBook(venue: VenueKey, today: string, marketCode = ""): Promise<PriceBook> {
  const codes = Object.keys(SOURCE_MAP);
  // 先讀資料庫（都是索引查詢，很快），有資料就直接回應、同步排到背景；完全沒有才等。
  let ctx = await loadContext(today, codes);
  const hasData = !!(ctx.retail || ctx.wholesale);
  await refreshInBackground(hasData);
  if (!hasData) ctx = await loadContext(today, codes);

  const quotes: Record<string, PriceQuote> = {};
  for (const code of codes) {
    const quote = readQuote(code, venue, ctx, marketCode, false);
    if (quote) quotes[code] = quote;
  }

  const dataDate =
    (venue === "wholesale" ? ctx.wholesale?.date : ctx.retail?.date) ??
    ctx.retail?.date ??
    ctx.wholesale?.date ??
    today;

  const markets = venue === "super" ? [] : marketOptionsOf(venue === "wholesale" ? ctx.wholesale : ctx.retail);
  return { dataDate, quotes, markets };
}

/** 有標章的成交量至少要佔當天的這個比例，那個均價才有代表性。 */
const MIN_CERTIFIED_SHARE = 5;

/** 「有標章 vs 一般」的比較。只有蔬果、而且那五個回報的市場當天有成交才有。 */
async function readTraced(code: string, onOrBefore: string): Promise<TracedCompare | undefined> {
  const doc = await (await tracedColl()).findOne({ date: { $lte: onOrBefore } }, { sort: { date: -1 } });
  const cell = doc?.byCode[code];
  if (!doc || !cell || cell.plainKg <= 0) return undefined;

  // 有標章的成交量佔比太低時不顯示。實際遇過甘藍「有標章 31 元 vs 一般 10 元」——
  // 貴 209%，但有標章的只佔當天成交量 1%，那個均價可能只是一兩批特殊規格的貨。
  // 與其顯示一個加註「代表性有限」的荒謬數字，不如不顯示。
  if (cell.certifiedShare < MIN_CERTIFIED_SHARE) return undefined;

  // 倍數離譜（三倍以上或反而便宜三分之二以上）同樣是樣本太少造成的，不顯示。
  const ratio = cell.certifiedKg / cell.plainKg;
  if (ratio > 3 || ratio < 0.34) return undefined;

  return {
    date: doc.date,
    certifiedKg: cell.certifiedKg,
    plainKg: cell.plainKg,
    percent: Math.round(((cell.certifiedKg - cell.plainKg) / cell.plainKg) * 100),
    certifiedShare: cell.certifiedShare,
  };
}

/** 詳情頁用：單一品項的完整資料（含各市場明細與走勢）。 */
export async function getItemDetail(code: string, venue: VenueKey, today: string, marketCode = ""): Promise<ItemDetail | null> {
  let ctx = await loadContext(today, [code]);
  const hasData = !!(ctx.retail || ctx.wholesale);
  await refreshInBackground(hasData);
  if (!hasData) ctx = await loadContext(today, [code]);
  const quote = readQuote(code, venue, ctx, marketCode, true);
  if (!quote) return null;

  // 走勢取自己場所的。推估出來的場所沒有自己的走勢，所以拿來源場所的點**乘上同一個
  // 倍數中點**，曲線的形狀才跟上面那個報價一致——不然走勢圖的數字跟卡片上的對不起來。
  const sourceVenue: VenueKey = quote.source === "derived" ? (ctx.retail?.byCode[code] ? "market" : "wholesale") : venue === "super" ? "market" : venue;
  const doc = await (await seriesColl()).findOne({ _id: `${sourceVenue}:${code}` });
  const sourceQuote = quote.source === "derived" ? readQuote(code, sourceVenue, ctx, "", false) : null;
  const k = sourceQuote && sourceQuote.avgKg > 0 ? quote.avgKg / sourceQuote.avgKg : 1;
  const series: PricePoint[] = (doc?.points ?? []).map(([date, avgKg]) => ({ date, avgKg: round1(avgKg * k) }));

  const venues = (["market", "super", "wholesale"] as VenueKey[]).map((v) => ({
    venue: v,
    // 比價一律看「全部市場」的代表價，不套用使用者選的市場——三個場所的市場清單不一樣，
    // 其中一個套了篩選、另外兩個沒套，數字就不能並排比較了。
    quote: readQuote(code, v, ctx, "", false),
  }));

  return { quote, series, venues, traced: await readTraced(code, today) };
}

