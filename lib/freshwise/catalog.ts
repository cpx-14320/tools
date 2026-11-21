// FreshWise 的品項目錄、分類、場所與市場清單——純資料，沒有伺服器端依賴，client
// component 可以直接匯入。
//
// 這份目錄是「畫面上會出現哪些菜」的唯一來源。真資料接上之後，品項清單會改成從農業部
// 的回應裡實際出現過的作物代號彙總出來，但 `aliases`（搜尋別名）、`icon`、`season`、
// `note` 這些「開放資料沒有、得自己維護」的欄位還是會留在這裡，所以這個檔案不會消失。
//
// baseKg 是批發基準價（元/公斤），假資料階段當成生成價格的中心值。數字取自 2026 年
// 常見行情的量級，不是精確報價——這個工具現階段要驗證的是版面與操作，不是數字正確性。

import { SOURCE_MAP } from "./source-map";
import type { CategoryKey, CategoryMeta, CatalogItem, MarketMeta, UnitKey, VenueKey, VenueMeta } from "./types";

/* ─────────────────────────── 分類 ─────────────────────────── */

export const CATEGORIES: CategoryMeta[] = [
  { key: "veg", name: "蔬菜", icon: "carrot" },
  { key: "fruit", name: "水果", icon: "apple-whole" },
  { key: "seafood", name: "漁產", icon: "fish" },
  { key: "meat", name: "肉類", icon: "drumstick-bite" },
  { key: "egg", name: "蛋品", icon: "egg" },
  { key: "grain", name: "糧食", icon: "wheat-awn" },
];

export function categoryName(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.name ?? key;
}

export function categoryIcon(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? "basket-shopping";
}

/* ─────────────────────────── 場所 ─────────────────────────── */

/**
 * 三種購買場所。順序就是畫面上分頁的順序，預設停在第一個（傳統市場）——這個工具的
 * 使用者是「不懂買菜價格的人」，他要去的是菜市場，不是批發市場。
 *
 * `estimated: true` 的場所（超市量販）在畫面上一律要帶「估算」徽章。理由寫在
 * types.ts 的 VenueKey：超市架上價沒有任何免費開放資料可接，數字是推估的，不標清楚
 * 就等於拿推估值冒充實際訪價。
 */
export const VENUES: VenueMeta[] = [
  {
    key: "market",
    name: "傳統市場",
    description: "菜市場攤位的零售價，台灣人習慣用台斤算。",
    icon: "store",
    defaultUnit: "catty",
    estimated: false,
  },
  {
    key: "super",
    // 超市與大賣場合成一個場所：兩邊都**沒有任何公開的架上價資料**，給它們不同的數字
    // 等於憑空編出精確度。名稱用使用者會講的「超市／大賣場」，不用「量販」這種業界詞。
    name: "超市／大賣場",
    description: "全聯、家樂福這類的架上價。沒有公開資料，只能依傳統市場價推估一個區間。",
    icon: "cart-shopping",
    defaultUnit: "catty",
    estimated: true,
  },
  {
    key: "wholesale",
    // 從「批發行情」改名成「批發市場」——這一排分頁問的是「你在哪裡買」，三個都用地點
    // 命名才一致。它不是消費者會去的地方，所以說明文字要把這件事講明。
    name: "批發市場",
    description: "果菜批發市場的拍賣價，是菜販的進貨成本，不是你在市場付的錢。",
    icon: "truck-ramp-box",
    defaultUnit: "kg",
    estimated: false,
  },
];

export function venueMeta(key: VenueKey): VenueMeta {
  return VENUES.find((v) => v.key === key) ?? VENUES[0];
}

export function venueName(key: VenueKey): string {
  return venueMeta(key).name;
}

export function venueDefaultUnit(key: VenueKey): UnitKey {
  return venueMeta(key).defaultUnit;
}

/**
 * 場所之間的「大概幾倍」。
 *
 * **這組數字只用在兩件事上：假資料生成，以及離群值檢查的量級參考。**
 * 真正要推估一個品項的零售價時不要用它——見下面 ESTIMATE_RANGE 的說明。
 */
export const VENUE_MULTIPLIER: Record<VenueKey, number> = {
  wholesale: 1,
  market: 2.2,
  super: 2.8,
};

/**
 * 推估用的倍數**區間**（不是單一係數）。
 *
 * ## 為什麼不能用單一係數
 *
 * 原本用「批發價 × 1.8」推估沒有實測零售價的品項。拿 23 個「臺中有訪價、批發也有」的
 * 品項回推實際倍數之後發現那是錯的：
 *
 * | 類別 | 實際倍數 |
 * | --- | --- |
 * | 葉菜 | 1.3 ～ 3.3 |
 * | 根莖 | 1.9 ～ 4.5 |
 * | 辛香（蔥薑蒜） | 2.4 ～ 2.7 |
 * | 瓜果 | 1.3 ～ 2.6 |
 * | 水果 | 1.2 ～ 3.0 |
 * | 漁產 | 1.5 ～ 2.5 |
 *
 * 香蕉只有 1.2 倍、蘿蔔卻到 4.5 倍。用 1.8 一律套的話，蘿蔔被低估六成、香蕉被高估五成
 * ——那是會讓人買錯的數字。
 *
 * ## 所以改成給區間
 *
 * 沒有實測價的品項，畫面上顯示「大概 X～Y 元」而不是一個精確的假數字。一個區間誠實地
 * 表達了「我們只知道大概範圍」，一個精確數字沒有。
 *
 * 這裡的數字是**退路**：正常情況下倍數是從我們自己的資料即時算出來的（見
 * prices.server.ts 的 estimateRatios——用當天同時有零售與批發的品項回推），只有在
 * 那天算不出來（例如零售資料整批缺）時才用這組固定值。
 *
 * 填的是上面那張表的**四分位距**（一般情況落在哪裡），不是最小到最大。取 min/max 的話
 * 區間會寬到四倍，那種區間只是在說「我們不知道」。
 */
export const ESTIMATE_RANGE: Record<CategoryKey, { low: number; high: number }> = {
  veg: { low: 2.0, high: 3.3 },
  fruit: { low: 1.4, high: 2.6 },
  seafood: { low: 1.8, high: 2.2 },
  // 肉類沒有任何批發來源可以乘（毛豬不算），所以這組對它沒有意義，填一個保守的範圍。
  meat: { low: 1.6, high: 2.2 },
  egg: { low: 1.2, high: 1.6 },
  // 米的零售與批發都有實測（糧價），不需要推估。
  grain: { low: 1.1, high: 1.3 },
};

/**
 * 超市／大賣場相對於傳統市場的倍數區間。
 *
 * **這組數字不是從資料來的**——超市的架上價沒有任何公開資料可查，所以這是「一般認知」
 * 的價差（貴一到三成）。畫面上一定要標清楚這件事，不能讓它看起來像實測。
 */
export const SUPER_OVER_MARKET = { low: 1.1, high: 1.35 };

/* ─────────────────────────── 市場 ─────────────────────────── */

/**
 * 市場清單。批發市場用的是真實名稱（之後農業部的回應裡就是這些名字，先對齊省得改）；
 * 傳統市場挑了幾個有公開訪價資料的公有市場。
 *
 * 超市量販刻意**不寫任何品牌名稱**（全聯、家樂福…）。假資料階段如果把生成出來的數字
 * 掛在真實品牌下面，畫面上看起來就像「這家店今天賣這個價」，那是我們根本沒有的資料；
 * 真資料階段這一欄也只會是推估值，同樣不該掛品牌。所以這裡用「連鎖超市（北部）」這種
 * 通稱，使用者一看就知道是通則不是某一家店的報價。
 */
export const MARKETS: MarketMeta[] = [
  // 傳統市場
  { code: "T01", name: "台中第二市場", city: "臺中市", venue: "market" },
  { code: "T02", name: "南屯市場", city: "臺中市", venue: "market" },
  { code: "T03", name: "清水第一市場", city: "臺中市", venue: "market" },
  { code: "T04", name: "豐原第一市場", city: "臺中市", venue: "market" },
  { code: "T05", name: "大里市場", city: "臺中市", venue: "market" },
  { code: "T06", name: "東門市場", city: "臺北市", venue: "market" },
  { code: "T07", name: "士東市場", city: "臺北市", venue: "market" },
  { code: "T08", name: "三民市場", city: "高雄市", venue: "market" },

  // 超市量販（通稱，不掛品牌）
  { code: "S01", name: "連鎖超市（北部）", city: "北部", venue: "super" },
  { code: "S02", name: "連鎖超市（中部）", city: "中部", venue: "super" },
  { code: "S03", name: "連鎖超市（南部）", city: "南部", venue: "super" },
  { code: "S04", name: "量販賣場（北部）", city: "北部", venue: "super" },
  { code: "S05", name: "量販賣場（中部）", city: "中部", venue: "super" },
  { code: "S06", name: "量販賣場（南部）", city: "南部", venue: "super" },

  // 批發市場（名稱對齊農業部交易行情的「市場名稱」）
  { code: "109", name: "台北一", city: "臺北市", venue: "wholesale" },
  { code: "104", name: "台北二", city: "臺北市", venue: "wholesale" },
  { code: "241", name: "三重區", city: "新北市", venue: "wholesale" },
  { code: "220", name: "板橋區", city: "新北市", venue: "wholesale" },
  { code: "400", name: "台中市", city: "臺中市", venue: "wholesale" },
  { code: "420", name: "豐原區", city: "臺中市", venue: "wholesale" },
  { code: "648", name: "西螺鎮", city: "雲林縣", venue: "wholesale" },
  { code: "700", name: "台南市", city: "臺南市", venue: "wholesale" },
  { code: "800", name: "高雄市", city: "高雄市", venue: "wholesale" },
  { code: "830", name: "鳳山區", city: "高雄市", venue: "wholesale" },
];

export function marketsOfVenue(venue: VenueKey): MarketMeta[] {
  return MARKETS.filter((m) => m.venue === venue);
}

export function marketName(code: string): string {
  return MARKETS.find((m) => m.code === code)?.name ?? "";
}

/* ─────────────────────────── 品項 ─────────────────────────── */

/** `season: ALL_YEAR` 代表全年都有，不特別標當季。 */
const ALL_YEAR: number[] = [];

export const CATALOG: CatalogItem[] = [
  // ── 蔬菜 ──────────────────────────────────────────────────
  { code: "FA1", name: "甘藍", category: "veg", aliases: ["高麗菜", "捲心菜"], icon: "leaf", baseKg: 18, season: [11, 12, 1, 2, 3, 4], note: "一顆約 1～1.5 公斤" },
  { code: "FA2", name: "結球白菜", category: "veg", aliases: ["大白菜", "山東白"], icon: "leaf", baseKg: 20, season: [11, 12, 1, 2, 3] },
  { code: "FA3", name: "小白菜", category: "veg", aliases: ["青菜"], icon: "leaf", baseKg: 28, season: ALL_YEAR },
  { code: "FA4", name: "青江菜", category: "veg", aliases: ["青江白菜", "湯匙菜"], icon: "leaf", baseKg: 25, season: ALL_YEAR },
  { code: "FA5", name: "蕹菜", category: "veg", aliases: ["空心菜"], icon: "leaf", baseKg: 30, season: [5, 6, 7, 8, 9, 10] },
  { code: "FA6", name: "菠菜", category: "veg", aliases: ["波菜"], icon: "leaf", baseKg: 45, season: [11, 12, 1, 2, 3] },
  { code: "FA7", name: "地瓜葉", category: "veg", aliases: ["甘薯葉"], icon: "leaf", baseKg: 25, season: ALL_YEAR },
  { code: "FA8", name: "莧菜", category: "veg", aliases: ["杏菜"], icon: "leaf", baseKg: 30, season: [4, 5, 6, 7, 8, 9] },
  { code: "FA9", name: "芹菜", category: "veg", aliases: ["本島芹菜"], icon: "leaf", baseKg: 40, season: [11, 12, 1, 2] },
  { code: "FB1", name: "韭菜", category: "veg", aliases: [], icon: "leaf", baseKg: 50, season: ALL_YEAR },
  { code: "FB2", name: "白蘿蔔", category: "veg", aliases: ["蘿蔔", "菜頭"], icon: "carrot", baseKg: 18, season: [11, 12, 1, 2, 3] },
  { code: "FB3", name: "胡蘿蔔", category: "veg", aliases: ["紅蘿蔔"], icon: "carrot", baseKg: 25, season: [12, 1, 2, 3, 4] },
  { code: "FB4", name: "青蔥", category: "veg", aliases: ["蔥", "大蔥"], icon: "seedling", baseKg: 65, season: ALL_YEAR, note: "颱風與連日大雨後最容易暴漲" },
  { code: "FB5", name: "洋蔥", category: "veg", aliases: [], icon: "circle", baseKg: 22, season: [2, 3, 4, 5] },
  { code: "FB6", name: "蒜頭", category: "veg", aliases: ["大蒜", "蒜球"], icon: "circle", baseKg: 95, season: [3, 4, 5] },
  { code: "FB7", name: "薑", category: "veg", aliases: ["老薑", "嫩薑"], icon: "circle", baseKg: 70, season: ALL_YEAR },
  { code: "FB8", name: "馬鈴薯", category: "veg", aliases: ["洋芋"], icon: "circle", baseKg: 28, season: [1, 2, 3, 4] },
  { code: "FB9", name: "甘藷", category: "veg", aliases: ["地瓜", "番薯"], icon: "circle", baseKg: 25, season: ALL_YEAR },
  { code: "FC1", name: "山藥", category: "veg", aliases: [], icon: "circle", baseKg: 90, season: [10, 11, 12, 1] },
  { code: "FC2", name: "竹筍", category: "veg", aliases: ["綠竹筍", "麻竹筍"], icon: "seedling", baseKg: 60, season: [4, 5, 6, 7, 8, 9] },
  { code: "FC3", name: "番茄", category: "veg", aliases: ["牛番茄", "黑柿番茄"], icon: "apple-whole", baseKg: 35, season: [11, 12, 1, 2, 3, 4] },
  { code: "FC4", name: "小番茄", category: "veg", aliases: ["玉女", "聖女", "聖女番茄"], icon: "apple-whole", baseKg: 95, season: [12, 1, 2, 3, 4] },
  { code: "FC5", name: "絲瓜", category: "veg", aliases: ["菜瓜"], icon: "lemon", baseKg: 35, season: [5, 6, 7, 8, 9, 10] },
  { code: "FC6", name: "胡瓜", category: "veg", aliases: ["大黃瓜"], icon: "lemon", baseKg: 28, season: [4, 5, 6, 7, 8, 9, 10] },
  { code: "FC7", name: "花胡瓜", category: "veg", aliases: ["小黃瓜", "刺瓜"], icon: "lemon", baseKg: 42, season: ALL_YEAR },
  { code: "FC8", name: "苦瓜", category: "veg", aliases: ["白玉苦瓜"], icon: "lemon", baseKg: 38, season: [5, 6, 7, 8, 9, 10] },
  { code: "FC9", name: "茄子", category: "veg", aliases: ["麻芝茄"], icon: "lemon", baseKg: 40, season: [4, 5, 6, 7, 8, 9, 10] },
  { code: "FD1", name: "青椒", category: "veg", aliases: ["大同仔"], icon: "pepper-hot", baseKg: 55, season: [11, 12, 1, 2, 3, 4] },
  { code: "FD2", name: "甜椒", category: "veg", aliases: ["彩椒", "紅椒", "黃椒"], icon: "pepper-hot", baseKg: 75, season: [11, 12, 1, 2, 3, 4] },
  { code: "FD3", name: "花椰菜", category: "veg", aliases: ["白花椰", "椰菜花"], icon: "leaf", baseKg: 45, season: [11, 12, 1, 2, 3] },
  { code: "FD4", name: "青花菜", category: "veg", aliases: ["綠花椰", "西蘭花", "青花椰"], icon: "leaf", baseKg: 50, season: [11, 12, 1, 2, 3] },
  { code: "FD5", name: "玉米", category: "veg", aliases: ["甜玉米", "玉蜀黍"], icon: "wheat-awn", baseKg: 30, season: ALL_YEAR },
  { code: "FD6", name: "四季豆", category: "veg", aliases: ["敏豆"], icon: "seedling", baseKg: 58, season: [10, 11, 12, 1, 2, 3] },
  { code: "FD7", name: "毛豆", category: "veg", aliases: [], icon: "seedling", baseKg: 45, season: [3, 4, 5, 10, 11] },
  { code: "FD8", name: "豆芽菜", category: "veg", aliases: ["綠豆芽", "銀芽"], icon: "seedling", baseKg: 20, season: ALL_YEAR },
  { code: "FD9", name: "金針菇", category: "veg", aliases: [], icon: "seedling", baseKg: 50, season: ALL_YEAR },
  { code: "FE1", name: "香菇", category: "veg", aliases: ["鮮香菇", "冬菇"], icon: "seedling", baseKg: 155, season: [11, 12, 1, 2] },
  { code: "FE2", name: "杏鮑菇", category: "veg", aliases: [], icon: "seedling", baseKg: 70, season: ALL_YEAR },
  { code: "FE3", name: "九層塔", category: "veg", aliases: ["羅勒"], icon: "leaf", baseKg: 80, season: ALL_YEAR },
  { code: "FE4", name: "香菜", category: "veg", aliases: ["芫荽"], icon: "leaf", baseKg: 130, season: [11, 12, 1, 2, 3] },

  // ── 水果 ──────────────────────────────────────────────────
  { code: "GA1", name: "香蕉", category: "fruit", aliases: ["芎蕉"], icon: "apple-whole", baseKg: 30, season: ALL_YEAR },
  { code: "GA2", name: "鳳梨", category: "fruit", aliases: ["金鑽鳳梨", "旺來"], icon: "apple-whole", baseKg: 28, season: [3, 4, 5, 6, 7] },
  { code: "GA3", name: "西瓜", category: "fruit", aliases: ["大西瓜"], icon: "apple-whole", baseKg: 18, season: [5, 6, 7, 8] },
  { code: "GA4", name: "木瓜", category: "fruit", aliases: ["網室木瓜"], icon: "apple-whole", baseKg: 35, season: ALL_YEAR },
  { code: "GA5", name: "番石榴", category: "fruit", aliases: ["芭樂", "珍珠芭樂"], icon: "apple-whole", baseKg: 40, season: [11, 12, 1, 2, 3] },
  { code: "GA6", name: "蘋果", category: "fruit", aliases: ["進口蘋果"], icon: "apple-whole", baseKg: 85, season: ALL_YEAR },
  { code: "GA7", name: "柳橙", category: "fruit", aliases: ["柳丁"], icon: "apple-whole", baseKg: 30, season: [11, 12, 1] },
  { code: "GA8", name: "椪柑", category: "fruit", aliases: ["橘子"], icon: "apple-whole", baseKg: 35, season: [11, 12, 1] },
  { code: "GA9", name: "茂谷柑", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 55, season: [1, 2, 3] },
  { code: "GB1", name: "葡萄", category: "fruit", aliases: ["巨峰葡萄"], icon: "apple-whole", baseKg: 115, season: [6, 7, 8, 11, 12] },
  { code: "GB2", name: "火龍果", category: "fruit", aliases: ["紅龍果"], icon: "apple-whole", baseKg: 50, season: [6, 7, 8, 9, 10] },
  { code: "GB3", name: "芒果", category: "fruit", aliases: ["愛文芒果", "金煌"], icon: "apple-whole", baseKg: 90, season: [5, 6, 7, 8] },
  { code: "GB4", name: "荔枝", category: "fruit", aliases: ["黑葉荔枝"], icon: "apple-whole", baseKg: 85, season: [5, 6, 7] },
  { code: "GB5", name: "龍眼", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 50, season: [7, 8, 9] },
  { code: "GB6", name: "蓮霧", category: "fruit", aliases: ["黑珍珠"], icon: "apple-whole", baseKg: 95, season: [12, 1, 2, 3, 4] },
  { code: "GB7", name: "棗子", category: "fruit", aliases: ["蜜棗", "印度棗"], icon: "apple-whole", baseKg: 70, season: [12, 1, 2, 3] },
  { code: "GB8", name: "梨", category: "fruit", aliases: ["新興梨", "水梨", "橫山梨"], icon: "apple-whole", baseKg: 70, season: [7, 8, 9, 10] },
  { code: "GB9", name: "甜柿", category: "fruit", aliases: ["柿子"], icon: "apple-whole", baseKg: 85, season: [10, 11, 12] },
  { code: "GC1", name: "文旦", category: "fruit", aliases: ["柚子", "麻豆文旦"], icon: "apple-whole", baseKg: 35, season: [8, 9] },
  { code: "GC2", name: "檸檬", category: "fruit", aliases: ["無籽檸檬"], icon: "lemon", baseKg: 40, season: [5, 6, 7, 8, 9] },
  { code: "GC3", name: "草莓", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 320, season: [12, 1, 2, 3] },
  { code: "GC4", name: "哈密瓜", category: "fruit", aliases: ["洋香瓜"], icon: "apple-whole", baseKg: 70, season: [4, 5, 6, 10, 11] },
  { code: "GC5", name: "奇異果", category: "fruit", aliases: ["進口奇異果"], icon: "apple-whole", baseKg: 105, season: ALL_YEAR },
  { code: "GC6", name: "酪梨", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 70, season: [7, 8, 9, 10, 11] },

  // ── 漁產 ──────────────────────────────────────────────────
  { code: "HA1", name: "吳郭魚", category: "seafood", aliases: ["台灣鯛"], icon: "fish", baseKg: 70, season: ALL_YEAR },
  { code: "HA2", name: "虱目魚", category: "seafood", aliases: ["麻虱目"], icon: "fish", baseKg: 100, season: [5, 6, 7, 8, 9, 10] },
  { code: "HA3", name: "金目鱸", category: "seafood", aliases: ["鱸魚"], icon: "fish", baseKg: 130, season: ALL_YEAR },
  { code: "HA4", name: "龍虎斑", category: "seafood", aliases: ["石斑", "斑魚"], icon: "fish", baseKg: 230, season: ALL_YEAR },
  { code: "HA5", name: "午仔魚", category: "seafood", aliases: ["馬鮁"], icon: "fish", baseKg: 200, season: [9, 10, 11, 12] },
  { code: "HA6", name: "白帶魚", category: "seafood", aliases: [], icon: "fish", baseKg: 120, season: [10, 11, 12, 1, 2] },
  { code: "HA7", name: "鯖魚", category: "seafood", aliases: ["花飛"], icon: "fish", baseKg: 80, season: [10, 11, 12, 1] },
  { code: "HA8", name: "秋刀魚", category: "seafood", aliases: [], icon: "fish", baseKg: 90, season: [9, 10, 11] },
  { code: "HA9", name: "鬼頭刀", category: "seafood", aliases: ["飛烏虎"], icon: "fish", baseKg: 150, season: [4, 5, 6, 10, 11] },
  { code: "HB1", name: "旗魚", category: "seafood", aliases: ["丁挽"], icon: "fish", baseKg: 250, season: [11, 12, 1, 2, 3] },
  { code: "HB2", name: "鮭魚", category: "seafood", aliases: ["進口鮭魚", "三文魚"], icon: "fish", baseKg: 390, season: ALL_YEAR },
  { code: "HB3", name: "白蝦", category: "seafood", aliases: ["草蝦", "蝦子"], icon: "shrimp", baseKg: 290, season: ALL_YEAR },
  { code: "HB4", name: "文蛤", category: "seafood", aliases: ["蛤蜊", "蚶仔"], icon: "shrimp", baseKg: 120, season: [4, 5, 6, 7, 8, 9] },
  { code: "HB5", name: "牡蠣", category: "seafood", aliases: ["蚵仔", "生蠔"], icon: "shrimp", baseKg: 185, season: [3, 4, 5, 10, 11, 12] },
  { code: "HB6", name: "透抽", category: "seafood", aliases: ["中卷", "小卷"], icon: "shrimp", baseKg: 350, season: [5, 6, 7, 8, 9] },
  { code: "HB7", name: "花枝", category: "seafood", aliases: ["烏賊", "墨魚"], icon: "shrimp", baseKg: 300, season: ALL_YEAR },

  // ── 肉類 ──────────────────────────────────────────────────
  { code: "MA1", name: "豬里肌", category: "meat", aliases: ["里肌肉", "大里肌"], icon: "bacon", baseKg: 205, season: ALL_YEAR },
  { code: "MA2", name: "豬後腿", category: "meat", aliases: ["後腿肉", "腿肉"], icon: "bacon", baseKg: 175, season: ALL_YEAR },
  { code: "MA3", name: "豬五花", category: "meat", aliases: ["五花肉", "三層肉"], icon: "bacon", baseKg: 245, season: ALL_YEAR },
  { code: "MA4", name: "豬梅花", category: "meat", aliases: ["梅花肉"], icon: "bacon", baseKg: 235, season: ALL_YEAR },
  { code: "MA5", name: "豬絞肉", category: "meat", aliases: ["絞肉"], icon: "bacon", baseKg: 185, season: ALL_YEAR },
  { code: "MA6", name: "豬小排", category: "meat", aliases: ["小排骨", "排骨"], icon: "bacon", baseKg: 265, season: ALL_YEAR },
  { code: "MB1", name: "牛腱", category: "meat", aliases: ["冷凍牛腱"], icon: "bacon", baseKg: 285, season: ALL_YEAR },
  { code: "MB2", name: "牛腩", category: "meat", aliases: ["冷凍牛腩", "腩肉"], icon: "bacon", baseKg: 325, season: ALL_YEAR },
  { code: "MB3", name: "牛腿肉", category: "meat", aliases: ["冷凍牛腿"], icon: "bacon", baseKg: 300, season: ALL_YEAR },
  { code: "MB4", name: "牛肉火鍋片", category: "meat", aliases: ["火鍋肉片"], icon: "bacon", baseKg: 360, season: [11, 12, 1, 2] },
  { code: "MC1", name: "雞胸肉", category: "meat", aliases: ["清胸肉"], icon: "drumstick-bite", baseKg: 120, season: ALL_YEAR },
  { code: "MC2", name: "雞腿", category: "meat", aliases: ["棒棒腿", "雞腿肉"], icon: "drumstick-bite", baseKg: 145, season: ALL_YEAR },
  { code: "MC3", name: "雞翅", category: "meat", aliases: ["二節翅"], icon: "drumstick-bite", baseKg: 165, season: ALL_YEAR },
  { code: "MC4", name: "肉雞", category: "meat", aliases: ["白肉雞", "全雞"], icon: "drumstick-bite", baseKg: 100, season: ALL_YEAR },
  { code: "MC5", name: "土雞", category: "meat", aliases: ["放山雞"], icon: "drumstick-bite", baseKg: 205, season: ALL_YEAR },
  { code: "MC6", name: "鴨肉", category: "meat", aliases: ["土番鴨"], icon: "drumstick-bite", baseKg: 180, season: ALL_YEAR },
  { code: "MC7", name: "仿雞", category: "meat", aliases: ["仿仔雞"], icon: "drumstick-bite", baseKg: 170, season: ALL_YEAR },

  // ── 蛋品 ──────────────────────────────────────────────────
  { code: "EA1", name: "雞蛋", category: "egg", aliases: ["紅殼蛋", "散裝蛋"], icon: "egg", baseKg: 70, season: ALL_YEAR, note: "一台斤約 9～10 顆" },
  { code: "EA2", name: "洗選蛋", category: "egg", aliases: ["盒蛋", "洗選雞蛋"], icon: "egg", baseKg: 98, season: ALL_YEAR, note: "一盒 10 顆裝" },
  { code: "EA3", name: "鴨蛋", category: "egg", aliases: [], icon: "egg", baseKg: 88, season: ALL_YEAR },
  { code: "EA4", name: "鵪鶉蛋", category: "egg", aliases: [], icon: "egg", baseKg: 125, season: ALL_YEAR },
  { code: "EA5", name: "皮蛋", category: "egg", aliases: [], icon: "egg", baseKg: 145, season: ALL_YEAR },
  { code: "EA6", name: "鹹鴨蛋", category: "egg", aliases: ["鹹蛋"], icon: "egg", baseKg: 135, season: ALL_YEAR },

  // ── 糧食 ──────────────────────────────────────────────────
  // 米是唯一「全國各縣市都有每日零售價」的品項（糧價那支 API），其他品項的零售訪價
  // 只有臺中市。baseKg 填的是批發價的量級，跟其他品項一致。
  { code: "RA1", name: "蓬萊米", category: "grain", aliases: ["白米", "梗米", "稉米"], icon: "wheat-awn", baseKg: 38, season: ALL_YEAR, note: "一包 2 公斤約 100 元上下" },
  { code: "RA2", name: "在來米", category: "grain", aliases: ["秈米", "在來硬"], icon: "wheat-awn", baseKg: 40, season: ALL_YEAR, note: "蘿蔔糕、碗粿用的米" },
  { code: "RA3", name: "在來米（軟）", category: "grain", aliases: ["在來軟"], icon: "wheat-awn", baseKg: 42, season: ALL_YEAR },
  { code: "RA4", name: "圓糯米", category: "grain", aliases: ["糯米", "圓糯"], icon: "wheat-awn", baseKg: 48, season: ALL_YEAR, note: "湯圓、油飯用的米" },
  { code: "RA5", name: "長糯米", category: "grain", aliases: ["長糯"], icon: "wheat-awn", baseKg: 48, season: ALL_YEAR, note: "粽子、米糕用的米" },
];

/**
 * 真的有開放資料可以查的品項。畫面上一律用這一份，不要用 CATALOG——
 * 目錄裡有十幾個品項（山藥、鬼頭刀、雞胸肉、雞腿、皮蛋…）目前找不到任何免費資料來源，
 * 列出來只會變成一排「查無資料」。
 *
 * 保留在 CATALOG 裡而不是直接刪掉，是因為別名、產季、計量提示這些欄位都還有用——哪天
 * 有了資料來源（例如使用者回報功能上線），在 source-map.ts 補一行就會自動出現。
 */
export const TRACKED_CATALOG: CatalogItem[] = CATALOG.filter((item) => !!SOURCE_MAP[item.code]);

/**
 * 品項圖片的路徑。圖片還沒畫好之前，畫面會自動退回顯示 `item.icon`（Font Awesome 的
 * 向量圖示），所以現在就可以用——圖片檔丟進 `public/freshwise/items/` 之後不用改程式。
 *
 * 檔名用品項代碼（`FA1.png`），不用中文名：中文檔名在不同作業系統、不同編碼下很容易出
 * 問題，而代碼本來就是這個品項的穩定識別。
 */
export function itemImage(code: string): string {
  return `/freshwise/item-${code}.png`;
}

/** 分類圖片的路徑。同樣是「有圖就用圖、沒圖退回向量圖示」。 */
export function categoryImage(key: CategoryKey): string {
  return `/freshwise/category-${key}.png`;
}

const BY_CODE = new Map(CATALOG.map((item) => [item.code, item]));

export function findItem(code: string): CatalogItem | undefined {
  return BY_CODE.get(code);
}

/** 找不到品項時不要讓畫面整頁壞掉（例如使用者的菜籃裡留著一個後來從目錄移除的代碼），
 *  回傳一個看得出是「已下架」的佔位品項，呼叫端照樣能畫出一列。 */
export function itemOrPlaceholder(code: string): CatalogItem {
  return (
    BY_CODE.get(code) ?? {
      code,
      name: "已下架品項",
      category: "veg",
      aliases: [],
      icon: "circle-question",
      baseKg: 0,
      season: ALL_YEAR,
    }
  );
}

export function itemsOfCategory(category: CategoryKey): CatalogItem[] {
  return CATALOG.filter((item) => item.category === category);
}

/** 這個品項這個月份是不是當季。season 空陣列（全年都有）一律回 false——全年都有的東西
 *  標「當季」沒有資訊量，反而會讓真正的當季提示變得不值得看。 */
export function isInSeason(item: CatalogItem, month: number): boolean {
  return item.season.includes(month);
}
