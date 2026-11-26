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
import type { CategoryKey, CategoryMeta, CatalogItem, MarketMeta, PantryItem, UnitKey, VenueKey, VenueMeta } from "./types";

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
    // 不再是可選場所：超市／大賣場沒有任何公開的架上價，整個場所的數字都是從零售價
    // 乘係數推估的。給使用者一個「可以切過去看」的分頁，等於暗示那邊有真實資料。
    selectable: false,
    // 超市與大賣場合成一個場所：兩邊都**沒有任何公開的架上價資料**，給它們不同的數字
    // 等於憑空編出精確度。名稱用使用者會講的「超市／大賣場」，不用「量販」這種業界詞。
    name: "超市／大賣場",
    description: "全聯、家樂福這類的架上價。沒有公開資料，只能依傳統市場價推估一個區間。",
    icon: "cart-shopping",
    defaultUnit: "catty",
    estimated: true,
  },
  // 批發市場**不列為可選場所**：那是菜販的進貨成本，一般人不能去批發市場買一顆高麗菜。
  // 高麗菜批發 18 元/公斤、傳統市場 50 元/台斤，差 2.8 倍——讓「不懂買菜價格的人」看到
  // 18 這個數字，等於給了他一個去市場會被打臉的期待。
  //
  // 批發的**資料**沒有拿掉，它在底層有兩個用途：臺中沒有訪價的品項用批發價推估零售價
  // （標示「估算」），以及「有機／產銷履歷要多付多少」的比較基礎。
  {
    key: "wholesale",
    name: "批發市場",
    description: "果菜批發市場的拍賣價，是菜販的進貨成本，不是你在市場付的錢。",
    icon: "truck-ramp-box",
    defaultUnit: "kg",
    estimated: false,
    selectable: false,
  },
];

/** 使用者可以選的場所（畫面上的分頁、設定頁的預設場所都用這個，不要用 VENUES）。 */
export const SELECTABLE_VENUES: VenueMeta[] = VENUES.filter((v) => v.selectable !== false);

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

/**
 * ## `name` 一律用「一般人在市場會講的名字」，行情的正式名稱放 `aliases`
 *
 * 農業部行情用的是作物的正式名稱：甘藍、蕹菜、花胡瓜、結球白菜、番石榴、蓬萊米。
 * 這份目錄原本直接照抄，結果食譜寫「小黃瓜」、點進詳情頁卻看到「花胡瓜」，使用者會
 * 以為自己點錯了。所以主名稱改成俗名，正式名稱降為別名——別名一樣會被搜尋命中
 * （見 search.ts 的 `matchesKeyword`），詳情頁也會列出來（「又叫 花胡瓜、刺瓜」），
 * 所以兩個名字都找得到、也都看得到，只是主名稱是使用者講的那一個。
 *
 * **這跟 source-map.ts 無關**：取價是用 SOURCE_MAP 裡的 `match` 關鍵字去比對開放資料
 * 的作物名稱，不是比對這裡的 `name`。改名不會動到價格，但 SOURCE_MAP 的關鍵字仍然要
 * 寫行情的正式名稱。
 */

/** `season: ALL_YEAR` 代表全年都有，不特別標當季。 */
const ALL_YEAR: number[] = [];

export const CATALOG: CatalogItem[] = [
  // ── 蔬菜 ──────────────────────────────────────────────────
  { code: "FA1", name: "高麗菜", category: "veg", aliases: ["甘藍", "捲心菜"], icon: "leaf", baseKg: 18, season: [11, 12, 1, 2, 3, 4], note: "一顆約 1～1.5 公斤" },
  { code: "FA2", name: "大白菜", category: "veg", aliases: ["結球白菜", "包心白菜", "山東白"], icon: "leaf", baseKg: 20, season: [11, 12, 1, 2, 3] },
  { code: "FA3", name: "小白菜", category: "veg", aliases: ["青菜"], icon: "leaf", baseKg: 28, season: ALL_YEAR },
  { code: "FA4", name: "青江菜", category: "veg", aliases: ["青江白菜", "湯匙菜"], icon: "leaf", baseKg: 25, season: ALL_YEAR },
  { code: "FA5", name: "空心菜", category: "veg", aliases: ["蕹菜"], icon: "leaf", baseKg: 30, season: [5, 6, 7, 8, 9, 10] },
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
  { code: "FB9", name: "地瓜", category: "veg", aliases: ["甘藷", "番薯"], icon: "circle", baseKg: 25, season: ALL_YEAR },
  { code: "FC1", name: "山藥", category: "veg", aliases: [], icon: "circle", baseKg: 90, season: [10, 11, 12, 1] },
  { code: "FC2", name: "竹筍", category: "veg", aliases: ["綠竹筍", "麻竹筍"], icon: "seedling", baseKg: 60, season: [4, 5, 6, 7, 8, 9] },
  { code: "FC3", name: "番茄", category: "veg", aliases: ["牛番茄", "黑柿番茄"], icon: "apple-whole", baseKg: 35, season: [11, 12, 1, 2, 3, 4] },
  { code: "FC4", name: "小番茄", category: "veg", aliases: ["玉女", "聖女", "聖女番茄"], icon: "apple-whole", baseKg: 95, season: [12, 1, 2, 3, 4] },
  { code: "FC5", name: "絲瓜", category: "veg", aliases: ["菜瓜"], icon: "lemon", baseKg: 35, season: [5, 6, 7, 8, 9, 10] },
  { code: "FC6", name: "大黃瓜", category: "veg", aliases: ["胡瓜"], icon: "lemon", baseKg: 28, season: [4, 5, 6, 7, 8, 9, 10] },
  { code: "FC7", name: "小黃瓜", category: "veg", aliases: ["花胡瓜", "刺瓜"], icon: "lemon", baseKg: 42, season: ALL_YEAR },
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
  // 第二批（2026-11-22）：市場常見、原本查不到的。**不分品種**——菜攤上只會跟你說
  // 「南瓜」「萵苣」「辣椒」，不會分「南瓜-木瓜型 阿成」「萵苣菜-本島尖葉」。
  // source-map 那邊用基底名稱比對，一個品項把它底下的品種全部收進來算代表價。
  { code: "FF1", name: "南瓜", category: "veg", aliases: ["金瓜"], icon: "seedling", baseKg: 30, season: [3, 4, 5, 6, 7, 8, 9, 10] },
  { code: "FF2", name: "茼蒿", category: "veg", aliases: ["打某菜"], icon: "leaf", baseKg: 45, season: [11, 12, 1, 2, 3] },
  { code: "FF3", name: "芋頭", category: "veg", aliases: ["檳榔心芋"], icon: "circle", baseKg: 70, season: [9, 10, 11, 12, 1] },
  { code: "FF4", name: "萵苣", category: "veg", aliases: ["大陸妹", "福山萵苣", "油麥菜", "A菜"], icon: "leaf", baseKg: 35, season: ALL_YEAR },
  { code: "FF5", name: "辣椒", category: "veg", aliases: ["朝天椒", "糯米椒", "青龍椒"], icon: "pepper-hot", baseKg: 120, season: ALL_YEAR },
  { code: "FF6", name: "冬瓜", category: "veg", aliases: [], icon: "seedling", baseKg: 18, season: [5, 6, 7, 8, 9] },
  { code: "FF7", name: "黃秋葵", category: "veg", aliases: ["秋葵"], icon: "seedling", baseKg: 65, season: [5, 6, 7, 8, 9, 10] },
  { code: "FF8", name: "茭白筍", category: "veg", aliases: ["美人腿"], icon: "seedling", baseKg: 55, season: [5, 6, 7, 8, 9, 10] },
  { code: "FF9", name: "青花苔", category: "veg", aliases: ["青江花", "油菜花"], icon: "leaf", baseKg: 50, season: [11, 12, 1, 2, 3] },
  { code: "FG1", name: "芥菜", category: "veg", aliases: ["刈菜", "長年菜"], icon: "leaf", baseKg: 35, season: [11, 12, 1, 2] },
  { code: "FG2", name: "豌豆", category: "veg", aliases: ["甜豌豆", "豌豆莢", "荷蘭豆"], icon: "seedling", baseKg: 120, season: [11, 12, 1, 2, 3] },
  { code: "FG3", name: "玉米筍", category: "veg", aliases: [], icon: "seedling", baseKg: 85, season: ALL_YEAR },
  { code: "FG4", name: "西洋芹", category: "veg", aliases: ["西芹"], icon: "leaf", baseKg: 50, season: [11, 12, 1, 2, 3] },
  { code: "FG5", name: "皇宮菜", category: "veg", aliases: ["落葵"], icon: "leaf", baseKg: 40, season: [5, 6, 7, 8, 9, 10] },

  // 第二批（2026-11）：拿 11/11–11/22 連續 12 個完整交易日比對農業部「農產品交易行情」，
  // 這些品項 10/12 天以上都有報價。代號跳過 I（在網址列裡跟 1 分不出來）。
  //
  // 這一批**全部沒有臺中零售訪價**，畫面上一律是批發價推估的區間（帶「估算」）。
  { code: "FH1", name: "扁蒲", category: "veg", aliases: ["蒲仔", "瓠瓜"], icon: "seedling", baseKg: 19, season: [4, 5, 6, 7, 8, 9] },
  { code: "FH2", name: "油菜", category: "veg", aliases: [], icon: "leaf", baseKg: 43, season: [11, 12, 1, 2, 3] },
  { code: "FH3", name: "菜豆", category: "veg", aliases: ["敏豆", "長豆"], icon: "seedling", baseKg: 57, season: [4, 5, 6, 9, 10, 11] },
  { code: "FH4", name: "佛手瓜", category: "veg", aliases: ["隼人瓜", "香櫞瓜"], icon: "seedling", baseKg: 54, season: [3, 4, 5, 9, 10, 11] },
  // 龍鬚菜在開放資料裡叫「隼人瓜-瓜苗」，跟佛手瓜共用基底名稱但是完全不同的菜。
  // 用「隼人瓜」當品項名的話，攤位上指著龍鬚菜的人永遠搜不到。
  { code: "FH5", name: "龍鬚菜", category: "veg", aliases: ["隼人瓜瓜苗", "佛手瓜苗"], icon: "leaf", baseKg: 76, season: [4, 5, 6, 7, 8, 9, 10] },
  { code: "FH6", name: "芥藍菜", category: "veg", aliases: ["芥蘭"], icon: "leaf", baseKg: 46, season: [10, 11, 12, 1, 2, 3] },
  { code: "FH7", name: "蓮藕", category: "veg", aliases: ["藕"], icon: "circle", baseKg: 42, season: [6, 7, 8, 9] },
  { code: "FH8", name: "菱角", category: "veg", aliases: ["水栗"], icon: "circle", baseKg: 41, season: [9, 10, 11, 12] },
  { code: "FH9", name: "豆薯", category: "veg", aliases: ["涼薯", "刈薯"], icon: "circle", baseKg: 20, season: [11, 12, 1, 2] },
  { code: "FJ1", name: "花生", category: "veg", aliases: ["土豆", "落花生"], icon: "seedling", baseKg: 47, season: [7, 8, 9, 10, 11] },
  { code: "FJ2", name: "木耳", category: "veg", aliases: ["黑木耳", "濕木耳"], icon: "leaf", baseKg: 86, season: ALL_YEAR },
  { code: "FJ3", name: "秀珍菇", category: "veg", aliases: [], icon: "seedling", baseKg: 90, season: ALL_YEAR },
  { code: "FJ4", name: "鴻喜菇", category: "veg", aliases: [], icon: "seedling", baseKg: 53, season: ALL_YEAR },
  { code: "FJ5", name: "洋菇", category: "veg", aliases: ["蘑菇"], icon: "seedling", baseKg: 160, season: [11, 12, 1, 2, 3] },
  { code: "FJ6", name: "紅蔥頭", category: "veg", aliases: ["油蔥"], icon: "circle", baseKg: 108, season: [1, 2, 3, 4] },
  { code: "FJ7", name: "蘆筍", category: "veg", aliases: ["綠蘆筍"], icon: "seedling", baseKg: 248, season: [3, 4, 5, 6, 9, 10] },
  { code: "FJ8", name: "菜心", category: "veg", aliases: ["萵苣莖", "A菜心", "嫩莖萵苣"], icon: "leaf", baseKg: 28, season: [11, 12, 1, 2, 3] },
  { code: "FJ9", name: "大心菜", category: "veg", aliases: ["芥菜心", "莖用芥菜"], icon: "leaf", baseKg: 24, season: [11, 12, 1, 2, 3] },
  // 水蓮同理，藏在「海菜-水蓮」底下——叫「海菜」沒人認得出那是美濃水蓮。
  { code: "FK1", name: "水蓮", category: "veg", aliases: ["野蓮", "美濃水蓮"], icon: "leaf", baseKg: 90, season: [4, 5, 6, 7, 8, 9, 10] },
  { code: "FK2", name: "牛蒡", category: "veg", aliases: [], icon: "circle", baseKg: 25, season: [1, 2, 3, 11, 12] },

  // 第三批蔬菜（2026-11）。這一批的來歷跟前兩批不一樣：前兩批是「按交易量排序取前 40
  // 名」，所以排在 40 名之後的**從來沒進過候選清單**——不是被否決，是根本沒看到。
  // 這次改成把素材盤點表（ingredient-art-inventory.csv）裡「圖畫好了但沒有品項」的
  // 119 項全部實測一輪，門檻訂在「日均量 ≥ 50 公斤 且 覆蓋率 ≥ 80%」。
  { code: "FK3", name: "青蒜", category: "veg", aliases: ["蒜苗"], icon: "leaf", baseKg: 74, season: [11, 12, 1, 2, 3] },
  { code: "FK4", name: "美生菜", category: "veg", aliases: ["結球萵苣", "西生菜"], icon: "leaf", baseKg: 31, season: ALL_YEAR },
  { code: "FK5", name: "紅鳳菜", category: "veg", aliases: ["紅菜"], icon: "leaf", baseKg: 64, season: ALL_YEAR },
  { code: "FK6", name: "茴香", category: "veg", aliases: [], icon: "leaf", baseKg: 66, season: [11, 12, 1, 2, 3] },
  { code: "FK7", name: "韭黃", category: "veg", aliases: [], icon: "leaf", baseKg: 124, season: ALL_YEAR },
  { code: "FK8", name: "黃豆芽", category: "veg", aliases: ["大豆芽"], icon: "seedling", baseKg: 24, season: ALL_YEAR },
  { code: "FK9", name: "香茅", category: "veg", aliases: ["檸檬香茅"], icon: "leaf", baseKg: 58, season: [5, 6, 7, 8, 9, 10] },
  { code: "FL1", name: "過貓", category: "veg", aliases: ["過溝菜蕨", "蕨菜"], icon: "leaf", baseKg: 87, season: [4, 5, 6, 7, 8, 9] },
  { code: "FL2", name: "皇帝豆", category: "veg", aliases: ["萊豆", "白扁豆"], icon: "seedling", baseKg: 89, season: [11, 12, 1, 2, 3] },
  { code: "FL3", name: "鮑魚菇", category: "veg", aliases: ["蠔菇"], icon: "seedling", baseKg: 44, season: ALL_YEAR },
  { code: "FL4", name: "巴西利", category: "veg", aliases: ["洋香菜", "荷蘭芹"], icon: "leaf", baseKg: 75, season: ALL_YEAR },
  { code: "FL5", name: "紫高麗菜", category: "veg", aliases: ["紫甘藍"], icon: "leaf", baseKg: 33, season: ALL_YEAR },
  { code: "FL6", name: "川七", category: "veg", aliases: ["藤川七", "洋落葵"], icon: "leaf", baseKg: 52, season: [5, 6, 7, 8, 9, 10] },
  { code: "FL7", name: "山蘇", category: "veg", aliases: ["鳥巢蕨"], icon: "leaf", baseKg: 247, season: [3, 4, 5, 6, 7, 8] },
  { code: "FL8", name: "柳松菇", category: "veg", aliases: ["茶樹菇"], icon: "seedling", baseKg: 152, season: ALL_YEAR },
  { code: "FL9", name: "珊瑚菇", category: "veg", aliases: ["黃金菇"], icon: "seedling", baseKg: 100, season: ALL_YEAR },
  { code: "FM1", name: "草菇", category: "veg", aliases: [], icon: "seedling", baseKg: 77, season: [5, 6, 7, 8, 9] },
  { code: "FM2", name: "荸薺", category: "veg", aliases: ["馬蹄"], icon: "circle", baseKg: 65, season: [11, 12, 1, 2] },

  // 第四批蔬菜（2026-11）。門檻從「日均量 ≥ 50 公斤」放寬成「**有價格、有插畫就收**」。
  // 前幾批用量當門檻，結果把市場上真的買得到、只是批發量小或正值淡季的東西擋在外面
  // （金針花產季是 6–8 月，11 月當然只有 1/19 天有價）。醃漬與加工品也收——筍乾、
  // 鹹菜、蘿蔔乾、熟花生在乾貨攤就是獨立的商品，不是「某樣菜的加工狀態」。
  { code: "FM3", name: "芥藍芽", category: "veg", aliases: ["芥蘭芽"], icon: "seedling", baseKg: 57, season: [11, 12, 1, 2, 3] },
  { code: "FM4", name: "韭菜花", category: "veg", aliases: ["韭菜薹"], icon: "leaf", baseKg: 146, season: [6, 7, 8, 9, 10] },
  { code: "FM5", name: "洛神花", category: "veg", aliases: ["洛神葵"], icon: "leaf", baseKg: 33, season: [10, 11, 12] },
  { code: "FM6", name: "山茼蒿", category: "veg", aliases: ["昭和草"], icon: "leaf", baseKg: 48, season: [11, 12, 1, 2, 3] },
  { code: "FM7", name: "鹹菜", category: "veg", aliases: ["酸菜", "福菜"], icon: "leaf", baseKg: 16, season: ALL_YEAR },
  { code: "FM8", name: "小松菜", category: "veg", aliases: ["日本油菜"], icon: "leaf", baseKg: 46, season: [11, 12, 1, 2, 3] },
  { code: "FM9", name: "雪裡紅", category: "veg", aliases: ["雪裡蕻"], icon: "leaf", baseKg: 18, season: [11, 12, 1, 2] },
  { code: "FN1", name: "豌豆苗", category: "veg", aliases: ["豆苗"], icon: "leaf", baseKg: 118, season: [11, 12, 1, 2, 3] },
  { code: "FN2", name: "蘿蔔乾", category: "veg", aliases: ["菜脯"], icon: "circle", baseKg: 47, season: ALL_YEAR },
  { code: "FN3", name: "熟花生", category: "veg", aliases: ["炒花生", "水煮花生"], icon: "seedling", baseKg: 61, season: ALL_YEAR },
  { code: "FN4", name: "海帶", category: "veg", aliases: ["昆布"], icon: "leaf", baseKg: 44, season: ALL_YEAR },
  { code: "FN5", name: "醃瓜", category: "veg", aliases: ["花瓜", "醬瓜"], icon: "seedling", baseKg: 35, season: ALL_YEAR },
  { code: "FN6", name: "高麗菜芽", category: "veg", aliases: ["甘藍芽"], icon: "seedling", baseKg: 39, season: [11, 12, 1, 2, 3] },
  { code: "FN7", name: "甜菜根", category: "veg", aliases: ["紅菜頭"], icon: "circle", baseKg: 28, season: [11, 12, 1, 2, 3] },
  { code: "FN8", name: "筍片", category: "veg", aliases: [], icon: "seedling", baseKg: 68, season: ALL_YEAR },
  { code: "FN9", name: "筍乾", category: "veg", aliases: [], icon: "seedling", baseKg: 65, season: ALL_YEAR },
  { code: "FP1", name: "筍絲", category: "veg", aliases: [], icon: "seedling", baseKg: 49, season: ALL_YEAR },
  { code: "FP2", name: "樹薯", category: "veg", aliases: ["木薯"], icon: "circle", baseKg: 21, season: [10, 11, 12, 1] },
  { code: "FP3", name: "苜蓿芽", category: "veg", aliases: [], icon: "seedling", baseKg: 72, season: ALL_YEAR },
  { code: "FP4", name: "櫻桃蘿蔔", category: "veg", aliases: ["紅皮蘿蔔"], icon: "circle", baseKg: 66, season: [11, 12, 1, 2, 3] },
  { code: "FP5", name: "薑黃", category: "veg", aliases: ["鬱金"], icon: "circle", baseKg: 34, season: [10, 11, 12, 1] },
  { code: "FP6", name: "朴菜", category: "veg", aliases: ["朴子菜"], icon: "leaf", baseKg: 31, season: ALL_YEAR },
  { code: "FP7", name: "晚香玉筍", category: "veg", aliases: ["夜來香"], icon: "seedling", baseKg: 236, season: [5, 6, 7, 8, 9, 10] },
  { code: "FP8", name: "金針筍", category: "veg", aliases: ["金針菜"], icon: "seedling", baseKg: 99, season: [6, 7, 8, 9] },
  { code: "FP9", name: "半天筍", category: "veg", aliases: ["檳榔心"], icon: "seedling", baseKg: 63, season: ALL_YEAR },
  { code: "FQ1", name: "榨菜", category: "veg", aliases: [], icon: "leaf", baseKg: 32, season: ALL_YEAR },
  { code: "FQ2", name: "油菜花", category: "veg", aliases: ["菜心花"], icon: "leaf", baseKg: 40, season: [12, 1, 2, 3] },
  { code: "FQ3", name: "越瓜", category: "veg", aliases: ["醃瓜用越瓜"], icon: "seedling", baseKg: 18, season: [5, 6, 7, 8, 9] },
  { code: "FQ4", name: "蓮子", category: "veg", aliases: [], icon: "circle", baseKg: 273, season: [7, 8, 9] },
  { code: "FQ5", name: "菊芋", category: "veg", aliases: ["雪蓮薯", "洋薑"], icon: "circle", baseKg: 82, season: [11, 12, 1, 2] },
  { code: "FQ6", name: "石蓮花", category: "veg", aliases: ["觀音蓮"], icon: "leaf", baseKg: 66, season: ALL_YEAR },
  { code: "FQ7", name: "龍葵", category: "veg", aliases: ["黑甜仔菜", "烏甜菜"], icon: "leaf", baseKg: 33, season: [11, 12, 1, 2, 3] },
  { code: "FQ8", name: "虎豆", category: "veg", aliases: ["福豆"], icon: "seedling", baseKg: 98, season: [11, 12, 1, 2, 3] },
  { code: "FQ9", name: "菾菜", category: "veg", aliases: ["茄茉菜", "牛皮菜"], icon: "leaf", baseKg: 55, season: [11, 12, 1, 2, 3] },
  { code: "FR1", name: "花豆", category: "veg", aliases: ["大紅豆"], icon: "seedling", baseKg: 107, season: [11, 12, 1, 2] },
  { code: "FR2", name: "人參葉", category: "veg", aliases: [], icon: "leaf", baseKg: 10, season: ALL_YEAR },
  { code: "FR3", name: "金針花", category: "veg", aliases: ["黃花菜"], icon: "leaf", baseKg: 50, season: [6, 7, 8, 9] },

  // ── 水果 ──────────────────────────────────────────────────
  { code: "GA1", name: "香蕉", category: "fruit", aliases: ["芎蕉"], icon: "apple-whole", baseKg: 30, season: ALL_YEAR },
  { code: "GA2", name: "鳳梨", category: "fruit", aliases: ["金鑽鳳梨", "旺來"], icon: "apple-whole", baseKg: 28, season: [3, 4, 5, 6, 7] },
  { code: "GA3", name: "西瓜", category: "fruit", aliases: ["大西瓜"], icon: "apple-whole", baseKg: 18, season: [5, 6, 7, 8] },
  { code: "GA4", name: "木瓜", category: "fruit", aliases: ["網室木瓜"], icon: "apple-whole", baseKg: 35, season: ALL_YEAR },
  { code: "GA5", name: "芭樂", category: "fruit", aliases: ["番石榴", "珍珠芭樂"], icon: "apple-whole", baseKg: 40, season: [11, 12, 1, 2, 3] },
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

  // 第二批水果。桶柑與海梨柑現在（11 月）批發完全沒有報價——它們的產季是 12–3 月，
  // 而且是這一批裡**唯二臺中有零售訪價欄位**的兩項，進了產季會是實測價不是估算。
  { code: "GC7", name: "甜瓜", category: "fruit", aliases: ["香瓜", "美濃瓜"], icon: "apple-whole", baseKg: 30, season: [4, 5, 6, 7, 10, 11] },
  { code: "GC8", name: "百香果", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 64, season: [7, 8, 9, 10, 11, 12] },
  { code: "GC9", name: "釋迦", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 72, season: [11, 12, 1, 2, 3] },
  { code: "GD1", name: "楊桃", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 33, season: [10, 11, 12, 1, 2] },
  { code: "GD2", name: "葡萄柚", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 20, season: [9, 10, 11] },
  { code: "GD3", name: "紅柿", category: "fruit", aliases: ["軟柿", "水柿"], icon: "apple-whole", baseKg: 26, season: [9, 10, 11, 12] },
  { code: "GD4", name: "桶柑", category: "fruit", aliases: ["年柑"], icon: "apple-whole", baseKg: 30, season: [1, 2, 3] },
  { code: "GD5", name: "海梨柑", category: "fruit", aliases: ["海梨"], icon: "apple-whole", baseKg: 25, season: [12, 1, 2] },
  // 藍莓與櫻桃在批發行情裡 100% 是進口貨。這兩項不套「排除進口」的慣例——那條慣例
  // 是給「本土與進口並存、價差很大」的品項用的（胡蘿蔔、牛蒡），而這兩種台灣幾乎
  // 不產，排掉進口等於整項都不存在。蘋果（GA6）與奇異果（GC5）本來就是這樣處理的。
  { code: "GD6", name: "藍莓", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 253, season: ALL_YEAR },
  { code: "GD7", name: "櫻桃", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 446, season: [5, 6, 7, 11, 12, 1] },

  // 第三批水果。椰子、甘蔗、榴槤前一輪被我以「整顆賣／製糖用／區間太寬」排掉，那三個
  // 理由都站不住腳——西瓜、木瓜也是整顆賣，照樣收了；區間寬是推估模型的問題，不是這
  // 幾樣水果的問題。
  { code: "GD8", name: "椰子", category: "fruit", aliases: ["青椰子"], icon: "apple-whole", baseKg: 14, season: [5, 6, 7, 8, 9] },
  { code: "GD9", name: "甘蔗", category: "fruit", aliases: ["紅甘蔗"], icon: "apple-whole", baseKg: 10, season: [11, 12, 1, 2, 3] },
  { code: "GE1", name: "青木瓜", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 17, season: ALL_YEAR },
  { code: "GE2", name: "榴槤", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 114, season: [5, 6, 7, 8] },
  { code: "GE3", name: "桔子", category: "fruit", aliases: ["砂糖桔", "雜柑"], icon: "apple-whole", baseKg: 86, season: [11, 12, 1, 2] },
  { code: "GE4", name: "黃金果", category: "fruit", aliases: ["加蜜蛋黃果"], icon: "apple-whole", baseKg: 86, season: [7, 8, 9, 10] },
  { code: "GE5", name: "西施柚", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 18, season: [9, 10, 11] },
  { code: "GE6", name: "金棗", category: "fruit", aliases: ["金柑"], icon: "apple-whole", baseKg: 60, season: [11, 12, 1, 2] },
  { code: "GE7", name: "蛋黃果", category: "fruit", aliases: ["仙桃"], icon: "apple-whole", baseKg: 19, season: [7, 8, 9, 10, 11] },
  { code: "GE8", name: "橄欖", category: "fruit", aliases: ["青橄欖"], icon: "apple-whole", baseKg: 25, season: [9, 10, 11, 12] },
  { code: "GE9", name: "紅毛丹", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 180, season: [6, 7, 8] },
  { code: "GF1", name: "石榴", category: "fruit", aliases: ["安石榴"], icon: "apple-whole", baseKg: 138, season: ALL_YEAR },
  { code: "GF2", name: "栗子", category: "fruit", aliases: ["板栗"], icon: "apple-whole", baseKg: 51, season: [9, 10, 11, 12] },

  // 第四批水果。同上，有價有圖就收。
  { code: "GF3", name: "佛利蒙柑", category: "fruit", aliases: ["佛利蒙"], icon: "apple-whole", baseKg: 38, season: [11, 12, 1, 2] },
  { code: "GF4", name: "柿餅", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 140, season: [10, 11, 12, 1] },
  { code: "GF5", name: "珍珠柑", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 50, season: [11, 12, 1] },
  { code: "GF6", name: "龍眼乾", category: "fruit", aliases: ["桂圓", "龍眼肉"], icon: "apple-whole", baseKg: 128, season: ALL_YEAR },
  { code: "GF7", name: "芒果青", category: "fruit", aliases: ["情人果"], icon: "apple-whole", baseKg: 114, season: [3, 4, 5, 6] },
  { code: "GF8", name: "波羅蜜", category: "fruit", aliases: ["菠蘿蜜"], icon: "apple-whole", baseKg: 20, season: [6, 7, 8, 9] },
  { code: "GF9", name: "豔陽柑", category: "fruit", aliases: [], icon: "apple-whole", baseKg: 32, season: [12, 1, 2, 3] },
  { code: "GG1", name: "鳳梨花", category: "fruit", aliases: ["觀賞鳳梨"], icon: "apple-whole", baseKg: 21, season: ALL_YEAR },

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
  { code: "HB8", name: "肉魚", category: "seafood", aliases: ["瓜子鯧"], icon: "fish", baseKg: 200, season: ALL_YEAR },
  { code: "HB9", name: "黃魚", category: "seafood", aliases: ["黃花魚", "黃花"], icon: "fish", baseKg: 180, season: ALL_YEAR },
  { code: "HC1", name: "黑鯧", category: "seafood", aliases: ["烏鯧"], icon: "fish", baseKg: 260, season: ALL_YEAR },
  { code: "HC2", name: "四破魚", category: "seafood", aliases: ["四破"], icon: "fish", baseKg: 60, season: [5, 6, 7, 8, 9] },
  { code: "HC4", name: "虱目魚肚", category: "seafood", aliases: ["魚肚"], icon: "fish", baseKg: 240, season: ALL_YEAR },

  // 第二批漁產（2026-11）：拿 11/12–11/23 的漁產品交易行情比對，這八個完整交易日
  // （週日漁市休市）全部 8/8 有報價。挑選標準是「攤位上叫得出名字」——開放資料裡量
  // 最大的其實是「其他」「什魚」「其他非凍結魚」這類統計分類，那些不是品項。
  //
  // 代號接在 HC4 之後；HC3 空著是因為它曾經被配給鬼頭刀、後來發現跟 HA9 重複而作廢，
  // 不要回收再利用。
  { code: "HC5", name: "土魠", category: "seafood", aliases: ["土魠魚", "馬鮫"], icon: "fish", baseKg: 374, season: [11, 12, 1, 2, 3] },
  { code: "HC6", name: "白鯧", category: "seafood", aliases: ["正鯧", "斗鯧"], icon: "fish", baseKg: 330, season: [11, 12, 1, 2] },
  { code: "HC7", name: "紅目鰱", category: "seafood", aliases: ["紅目鯛", "大目鰱"], icon: "fish", baseKg: 202, season: ALL_YEAR },
  { code: "HC8", name: "七星鱸", category: "seafood", aliases: ["鱸魚", "七星"], icon: "fish", baseKg: 124, season: ALL_YEAR },
  { code: "HC9", name: "草魚", category: "seafood", aliases: ["鯇魚"], icon: "fish", baseKg: 103, season: ALL_YEAR },
  { code: "HD1", name: "大頭鰱", category: "seafood", aliases: ["鰱魚", "花鰱", "魚頭"], icon: "fish", baseKg: 71, season: ALL_YEAR },
  { code: "HD2", name: "烏魚", category: "seafood", aliases: ["烏仔魚", "鯔魚"], icon: "fish", baseKg: 70, season: [11, 12, 1] },
  { code: "HD3", name: "香魚", category: "seafood", aliases: [], icon: "fish", baseKg: 177, season: [6, 7, 8, 9, 10] },
  { code: "HD4", name: "赤鯮", category: "seafood", aliases: ["赤宗", "盤仔"], icon: "fish", baseKg: 168, season: [10, 11, 12, 1, 2] },
  { code: "HD5", name: "紅杉", category: "seafood", aliases: ["黃臘鰺", "紅沙"], icon: "fish", baseKg: 164, season: ALL_YEAR },
  { code: "HD6", name: "馬加", category: "seafood", aliases: ["馬加魚", "白腹"], icon: "fish", baseKg: 210, season: [12, 1, 2, 3, 4] },
  { code: "HD7", name: "吻仔魚", category: "seafood", aliases: ["勿仔", "魩仔魚"], icon: "fish", baseKg: 145, season: [3, 4, 5, 9, 10, 11] },
  { code: "HD8", name: "魷魚", category: "seafood", aliases: ["魷魚乾"], icon: "shrimp", baseKg: 138, season: ALL_YEAR },
  { code: "HD9", name: "蝦仁", category: "seafood", aliases: ["去殼蝦"], icon: "shrimp", baseKg: 241, season: ALL_YEAR },
  { code: "HE1", name: "扁鱈", category: "seafood", aliases: ["比目魚", "大比目魚"], icon: "fish", baseKg: 282, season: ALL_YEAR },

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
  { code: "RA1", name: "白米", category: "grain", aliases: ["蓬萊米", "梗米", "稉米"], icon: "wheat-awn", baseKg: 38, season: ALL_YEAR, note: "一包 2 公斤約 100 元上下" },
  { code: "RA2", name: "在來米", category: "grain", aliases: ["秈米", "在來硬"], icon: "wheat-awn", baseKg: 40, season: ALL_YEAR, note: "蘿蔔糕、碗粿用的米" },
  { code: "RA3", name: "在來米（軟）", category: "grain", aliases: ["在來軟"], icon: "wheat-awn", baseKg: 42, season: ALL_YEAR },
  { code: "RA4", name: "圓糯米", category: "grain", aliases: ["糯米", "圓糯"], icon: "wheat-awn", baseKg: 48, season: ALL_YEAR, note: "湯圓、油飯用的米" },
  { code: "RA5", name: "長糯米", category: "grain", aliases: ["長糯"], icon: "wheat-awn", baseKg: 48, season: ALL_YEAR, note: "粽子、米糕用的米" },
];

/* ──────────────────── 行情查不到的食材 ──────────────────── */

/**
 * 食譜會用到、但**在行情裡查不到**的食材。型別說明見 types.ts 的 `PantryItem`
 * （`processed` 是永遠不會有，`unlisted` 是目前沒有來源）。
 *
 * ## 為什麼要有這一份
 *
 * 使用者在行情頁搜「米粉」「豆腐」「油麵」，拿到的是一個空白的「找不到符合條件的食材」。
 * 那句話在這裡是錯的提示——它暗示「換個說法再搜一次」，但再怎麼換都搜不到：農業部的
 * 交易行情只收原型農產品，加工品不在裡面。使用者會一直試。
 *
 * 所以搜不到的時候要說清楚是哪一種搜不到：
 *   - 打錯字／不在目錄 → 「試試其他名稱」（本來的空狀態）
 *   - 這份清單裡的 → 「這樣東西沒有公開行情」＋原因（見 browse-view 的提示）
 *
 * ## 為什麼不是把它們加進 CATALOG
 *
 * 加進去會連帶跑進三個地方：行情清單（一排永遠查無價格的列）、品項選擇器（可以勾進
 * 菜籃，但菜籃只畫「有行情」的項目，勾了會憑空消失）、詳情頁（空的走勢圖）。
 * 它們不是「暫時沒資料的品項」，是**沒有價格這個欄位的東西**，混在一起只會讓每個用到
 * 目錄的地方都要多一個 if。
 *
 * 加工品的量在食譜裡仍然會算、會顯示（`main` 區的「400 公克板豆腐」），只是金額那一欄
 * 寫「無行情」——見 recipe-view 的 `IngredientRow`。
 */
export const PANTRY: PantryItem[] = [
  // ── 加工品與乾貨：行情只收原型農產品，這些永遠不會有 ──
  { key: "tofu", name: "豆腐", aliases: ["板豆腐", "嫩豆腐", "傳統豆腐", "老豆腐", "凍豆腐"], kind: "processed" },
  { key: "dried-tofu", name: "豆乾", aliases: ["豆干", "豆腐乾", "滷味豆乾"], kind: "processed" },
  { key: "fried-tofu", name: "油豆腐", aliases: ["豆泡", "三角油豆腐", "油炸豆腐"], kind: "processed" },
  { key: "tofu-skin", name: "豆皮", aliases: ["豆包", "腐皮", "生豆包"], kind: "processed" },
  { key: "soy-milk", name: "豆漿", aliases: ["無糖豆漿"], kind: "processed" },
  { key: "rice-vermicelli", name: "米粉", aliases: ["炊粉", "新竹米粉", "乾米粉", "粗米粉"], kind: "processed" },
  { key: "oil-noodles", name: "油麵", aliases: ["黃麵", "熟油麵", "熟麵"], kind: "processed" },
  { key: "udon", name: "烏龍麵", aliases: ["烏龍", "熟烏龍麵"], kind: "processed" },
  { key: "misua", name: "麵線", aliases: ["紅麵線", "白麵線", "麵線糊用麵線"], kind: "processed" },
  { key: "noodles", name: "麵條", aliases: ["生麵條", "陽春麵", "意麵", "拉麵", "刀削麵", "麵"], kind: "processed" },
  { key: "glass-noodles", name: "冬粉", aliases: ["粉絲", "綠豆冬粉"], kind: "processed" },
  { key: "flat-rice-noodles", name: "粿仔條", aliases: ["板條", "河粉", "粄條"], kind: "processed" },
  { key: "rice-cake", name: "年糕", aliases: ["寧波年糕", "炒年糕"], kind: "processed" },
  { key: "seaweed", name: "紫菜", aliases: ["海苔", "海苔片"], kind: "processed" },
  { key: "dried-shrimp", name: "蝦米", aliases: ["金鉤蝦", "小蝦米", "蝦皮"], kind: "processed" },
  { key: "kimchi", name: "泡菜", aliases: ["韓式泡菜", "台式泡菜"], kind: "processed" },
  { key: "curry-roux", name: "咖哩塊", aliases: ["咖哩醬", "咖哩粉"], kind: "processed" },
  { key: "hotpot-balls", name: "火鍋料", aliases: ["魚丸", "貢丸", "花枝丸", "蛋餃", "火鍋餃"], kind: "processed" },

  // ── 生鮮，但目前沒有任何公開訪價 ──
  // 跟上面那一組不一樣：這些是原型食材，哪天有了訪價來源（例如使用者回報）就該進 CATALOG，
  // 所以寫的時候不要講成「永遠不會有」。
  { key: "pork-offal", name: "豬內臟", aliases: ["豬腰", "腰子", "豬肝", "豬心", "豬大腸", "粉腸", "豬血"], kind: "unlisted" },
  { key: "mussel", name: "淡菜", aliases: ["孔雀蛤", "藍殼貝"], kind: "unlisted" },
];

/**
 * 關鍵字有沒有打到「行情查不到的食材」。
 *
 * 這裡用**開頭比對**，不是 `matchesKeyword` 那種任意位置的 `includes`：這個提示是插在
 * 清單上方的一句解釋，寧可少出現也不要亂出現。搜「菜」如果用 `includes` 會命中「紫菜」，
 * 於是一個有五十筆結果的搜尋上面會冒出一句「紫菜沒有行情」——那是雜訊。搜「麵」命中
 * 「麵線」「麵條」則是對的，所以也不能收得比開頭比對更緊。
 *
 * 空關鍵字一律不命中（沒搜東西就不需要這句解釋）。
 */
export function pantryMatches(keyword: string): PantryItem[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];
  return PANTRY.filter((item) => [item.name, ...item.aliases].some((n) => n.toLowerCase().startsWith(kw)));
}

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
 * 檔名用品項代碼（`FA1.webp`），不用中文名：中文檔名在不同作業系統、不同編碼下很容易出
 * 問題，而代碼本來就是這個品項的穩定識別。
 */
export function itemImage(code: string): string {
  return `/freshwise/item-${code}.webp`;
}

/** 分類圖片的路徑。同樣是「有圖就用圖、沒圖退回向量圖示」。 */
export function categoryImage(key: CategoryKey): string {
  return `/freshwise/category-${key}.webp`;
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
