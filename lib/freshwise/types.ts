// FreshWise（菜鳥不買貴）的資料型別。純型別宣告，沒有任何執行期程式碼，client 與
// server 都可以匯入——畫面需要的型別一律放這裡，不要從 *.server.ts 匯入型別。
//
// 欄位的形狀直接對應開放資料的原始欄位（MarketQuote 的上價／中價／下價就是農業部交易
// 行情那幾欄），所以從原始資料到畫面之間不需要再轉一層名字。

/** 品項大分類。使用者在行情頁用這個切分頁，首頁的分類快捷也是這五個。 */
export type CategoryKey = "veg" | "fruit" | "seafood" | "meat" | "egg" | "grain";

/**
 * 購買場所。這是整個工具的核心維度——同一樣菜在這三種地方的價差可以到兩倍以上，
 * 「不懂買菜價格的人」最需要知道的其實是「我要去的那種店該付多少」，不是全國均價。
 *
 * - `market`：傳統市場的零售攤價。之後接臺中市公有零售市場每日蔬果價格表（元/台斤）。
 * - `super`：超市／量販的架上價。目前**沒有**任何免費開放資料，真資料階段會是「以零售
 *   價乘上場所係數推估」或使用者回報，所以這一欄的數字一律要標示為估算（見
 *   PriceQuote.estimated），不能讓使用者以為是實際訪價。
 * - `wholesale`：批發市場的拍賣行情。之後接農業部農產品交易行情（元/公斤）。這是菜販的
 *   進貨價，不是消費者付的錢，所以預設不當主角，只用來看漲跌趨勢。
 */
export type VenueKey = "market" | "super" | "wholesale";

/** 顯示單位。台灣的傳統市場講台斤、批發行情講公斤，兩邊都要能看。 */
export type UnitKey = "catty" | "kg";

/** 漲跌方向。台灣習慣漲紅跌綠，而菜價「跌」對買菜的人是好事，配色見 theme.ts。 */
export type TrendDirection = "up" | "down" | "flat";

/** 跟近一年均價比起來今天算便宜還是貴——首頁的「今天買這個划算」就是靠這個判定。 */
export type ValueLevel = "cheap" | "fair" | "pricey";

export interface CategoryMeta {
  key: CategoryKey;
  name: string;
  /** Font Awesome 圖示名稱（不含 fa- 前綴）。 */
  icon: string;
}

export interface VenueMeta {
  key: VenueKey;
  /** 分頁上的短名稱（傳統市場／超市量販／批發行情）。 */
  name: string;
  /** 設定頁與說明文字用的完整說明。 */
  description: string;
  icon: string;
  /** 這個場所的價格預設用哪個單位顯示。 */
  defaultUnit: UnitKey;
  /** 這個場所的數字是不是推估值（超市量販沒有開放資料，是推估的）。 */
  estimated: boolean;
}

export interface MarketMeta {
  /** 市場代號，之後對應農業部的「市場代號」。 */
  code: string;
  name: string;
  /** 縣市，給市場選擇器分群用。 */
  city: string;
  venue: VenueKey;
}

export interface CatalogItem {
  /** 品項代碼。之後對應農業部的作物代號／品種代碼，所以是字串不是數字。 */
  code: string;
  name: string;
  category: CategoryKey;
  /** 搜尋用的別名（例如「甘藍」要能用「高麗菜」搜到）。 */
  aliases: string[];
  icon: string;
  /** 批發基準價（元/公斤）。假資料以這個數字為中心生成，真資料接上後這個欄位只剩
   *  「資料還沒回來時的骨架寬度參考」用途。 */
  baseKg: number;
  /** 當季月份（1–12）。當季的東西便宜又好吃，首頁與詳情頁都會提示。 */
  season: number[];
  /** 買菜時實際會遇到的計量提示，例如「一顆約 1 公斤」。 */
  note?: string;
}

/**
 * 某品項在某個市場、某一天的一筆行情。欄位比照農業部交易行情的原始資料——
 * **上價／中價／下價／平均價／交易量**就是行情表的標準五欄，菜價查詢的使用者看得懂的
 * 就是這個格式，所以原封不動帶上來。
 */
export interface MarketQuote {
  marketCode: string;
  marketName: string;
  city: string;
  /** 平均價，元/公斤。單位換算一律在顯示層做（見 lib/freshwise/price.ts），資料層只存
   *  公斤價，不要讓同一個欄位有時候是台斤有時候是公斤。 */
  avgKg: number;
  /** 上價（當天成交的高價）。 */
  highKg: number;
  /** 中價。批發行情才有；零售訪價只有一個數字，這一欄是 null。
   *  一開始漏掉這一欄（只存了上/下/平均），但它是行情表的標準欄位之一。 */
  midKg?: number | null;
  /** 下價（當天成交的低價）。 */
  lowKg: number;
  /** 交易量（公斤）。批發行情才有，零售訪價沒有這個欄位。
   *
   *  型別刻意寫成 `number | null`：這些報價是從 MongoDB 讀回來的，而**Mongo 會把
   *  `undefined` 存成 `null`**，所以讀回來的欄位不會是 undefined 而是 null。只宣告
   *  `number | undefined` 的話，`volumeKg !== undefined` 這種檢查在型別上過得去、
   *  執行時卻會拿 null 去呼叫 toLocaleString 然後整頁 500（實際踩過）。 */
  volumeKg?: number | null;
}

/**
 * 這筆價格是怎麼來的。畫面上要據此決定標不標「估算」，也決定說明文字怎麼寫——
 * 使用者有權知道他看到的數字是誰訪的價。
 *
 * - `retail`：臺中市公有零售市場的實際訪價（元/台斤）。最貼近「我在市場付多少」。
 * - `wholesale`：農業部批發市場的拍賣行情（元/公斤）。菜販的進貨成本。
 * - `origin`：產地價（雞蛋、白肉雞，來自家禽交易行情）。
 * - `grain`：糧價（白米）。**這是唯一全國各縣市都有每日零售價的來源**，所以米的零售價
 *   不是臺中訪價，標錯會讓使用者以為那是臺中一地的價格。
 * - `derived`：**沒有這個場所的實際資料，是從別的場所乘係數推估的。**
 */
export type PriceSource = "retail" | "wholesale" | "origin" | "grain" | "derived";

/** 某品項在某個場所、某一天的整合行情（已經把各市場合併成一個代表數字）。 */
export interface PriceQuote {
  code: string;
  /** 資料實際的日期（ISO）。可能比使用者的「今天」早——休市、或來源還沒更新。 */
  date: string;
  venue: VenueKey;
  /** 元/公斤的代表價（各市場的交易量加權平均；零售訪價沒有交易量，用算術平均）。 */
  avgKg: number;
  /** 上一個有資料的日子的代表價，用來算漲跌。沒有前一天資料時是 null。 */
  prevKg: number | null;
  /** 近一年的統計，用來判定今天算便宜還是貴。歷史不夠長時仍然會有值（就是目前已知的
   *  範圍），但要搭配 historyDays 判斷能不能信——見 hasReliableHistory。 */
  yearLowKg: number;
  yearHighKg: number;
  yearAvgKg: number;
  /** 這筆價格的來源。 */
  source: PriceSource;
  /** 這個數字是不是推估值。`source === "derived"` 時一定是 true。畫面上要標「估算」。 */
  estimated: boolean;
  /**
   * 推估的價格**區間**（元/公斤）。只有 `estimated` 的報價才有。
   *
   * 為什麼推估要給區間而不是單一數字：實測回推發現「零售 ÷ 批發」的倍數在 1.2～4.5 倍
   * 之間（香蕉 1.2、蘿蔔 4.5），用單一係數套出來的「精確」數字會錯到讓人買錯。區間誠實
   * 地表達「我們只知道大概範圍」。`avgKg` 仍然是區間的中點，排序與漲跌計算用它。
   */
  rangeLowKg?: number;
  rangeHighKg?: number;
  /** 當天的總成交量（公斤）。只有批發行情有；零售訪價沒有這個數字。
   *  清單頁要能按成交量排序，所以這一欄要跟著報價走，不能只放在各市場明細裡。 */
  volumeKg?: number | null;
  /** 已經累積幾天的歷史。批發行情的歷史是從接上資料那天開始一天一天累積的，天數不夠時
   *  「比近一年平均便宜 X%」這句話不能說。 */
  historyDays: number;
  /** 各市場的明細。清單頁不需要（省傳輸量），詳情頁才帶。 */
  markets: MarketQuote[];
}

/** 歷史走勢上的一個點。 */
export interface PricePoint {
  date: string;
  avgKg: number;
}

/** 我的菜籃的分類（第一層）。使用者自己命名，例如「每週常買」「火鍋」。 */
export interface BasketGroup {
  id: string;
  name: string;
  icon: string;
  order: number;
}

/** 我的菜籃裡的一筆（第二層）。 */
export interface BasketEntry {
  id: string;
  groupId: string;
  /** 對應 CatalogItem.code。 */
  code: string;
  /** 常買的份量（台斤），用來估算這一籃大概要花多少錢。沒填就是 null，不估金額。 */
  qtyCatty: number | null;
  order: number;
}

/** 使用者偏好。目前存在 localStorage（見 lib/freshwise/storage.ts），之後接資料庫
 *  時整包搬到 Mongo 的 freshwise.settings，欄位不用改。 */
export interface FreshwisePrefs {
  /** 預設看哪個場所的價格。 */
  venue: VenueKey;
  /** 預設用哪個單位顯示。 */
  unit: UnitKey;
  /** 預設的市場代號（空字串＝看這個場所的全部市場均價）。 */
  marketCode: string;
  /** 漲跌提醒門檻（%）。超過這個幅度的品項，首頁會特別點出來。 */
  alertPercent: number;
  /** 首頁要不要顯示「今天買菜建議」那張主視覺卡。 */
  showAdvice: boolean;
}

/** 一本「價格簿」：某個場所、某一天，整份目錄的行情。由伺服器端組好傳給畫面。 */
export interface PriceBook {
  /** 這本價格簿實際的資料日期（可能比使用者的今天早）。 */
  dataDate: string;
  /** 只含「有資料」的品項。沒有行情的品項不會出現在這裡，畫面上也不列出來——產季外的
   *  水果整段沒有交易就是這樣，補一列「查無資料」只是雜訊。 */
  quotes: Record<string, PriceQuote>;
  /** 這個場所今天真的有資料的市場。超市量販是推估的，所以是空陣列。 */
  markets: MarketOption[];
}

/**
 * 「有標章」與「一般」的批發行情比較，回答「有機／產銷履歷要多付多少」。
 *
 * 資料來自農業部的「產銷履歷與有機蔬果行情」，只有五個批發市場會回報，而且只有蔬果。
 * 標章的種類分不出來（來源的代碼表沒有公開），所以只分「有標章／一般」兩類——不要在
 * 畫面上宣稱那是有機還是產銷履歷。
 */
export interface TracedCompare {
  /** 資料日期。 */
  date: string;
  /** 有標章的成交加權均價（元/公斤）。 */
  certifiedKg: number;
  /** 沒有標章的成交加權均價（元/公斤）。 */
  plainKg: number;
  /** 有標章比一般貴多少 %（負數代表反而便宜）。 */
  percent: number;
  /** 有標章的成交量佔比（%）——只有一兩筆成交的話那個均價不太有代表性，畫面上要讓
   *  使用者看得到這件事。 */
  certifiedShare: number;
}

/** 詳情頁要的一整包：今日報價（含各市場明細）、歷史走勢、三個場所的比價。 */
export interface ItemDetail {
  quote: PriceQuote;
  /** 近一年的走勢（有多少算多少，批發的歷史是一天一天累積的）。 */
  series: PricePoint[];
  /** 三個場所的今日價。沒有行情的場所 quote 是 null，畫面上顯示「這個場所沒有這一項」。 */
  venues: { venue: VenueKey; quote: PriceQuote | null }[];
  /** 有標章 vs 一般的比較。只有蔬果、而且那五個市場今天有成交才有。 */
  traced?: TracedCompare;
}

/** 市場選擇器的一個選項。**從實際資料裡長出來的**，不是寫死的清單——哪些市場今天真的
 *  有交易，只有資料知道（見 lib/freshwise/prices.server.ts 的 marketOptionsOf）。 */
export interface MarketOption {
  code: string;
  name: string;
  city: string;
  /** 選擇器裡的分群標題。批發行情同時包含蔬果批發市場與魚市場，分開才不會讓使用者
   *  選了魚市場卻發現青菜全部消失（那是正確的結果，但看起來像壞掉）。 */
  group: string;
}
