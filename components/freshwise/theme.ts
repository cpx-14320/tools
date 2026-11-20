// FreshWise（菜鳥不買貴）的設計系統定義：色票、字級、間距、圓角、陰影、文案用詞。
//
// 結構刻意跟 components/transit/theme.ts 一模一樣（同一組 token 名稱、同一套字級階層、
// 同一份文案用詞表），這樣三個工具的程式碼讀起來是同一個手感，改一個工具學到的規則在
// 另一個工具也成立。**但色票是獨立的一份**：搭乘車是紫、記帳本是紫、這個工具是綠。
//
// 不要 import components/transit/theme.ts 或 components/expenses/theme.ts，也不要讓它們
// import 這裡。三份的 ink／muted 根本不是同一個顏色，混用的結果是「看起來幾乎一樣但就
// 是哪裡怪」的畫面，而且改錯了很難發現。
//
// 規則只有一條：**畫面上不要出現 token 以外的新數字、新顏色、新字級。** 需要一個現在
// 沒有的樣式時，先問「是不是既有 token 的某一階」，真的沒有才在這裡加一階並寫下理由。

export const colors = {
  /** 主要文字、標題、價格數字 */
  ink: "#2A4A36",
  /** 次要說明文字、欄位小標 */
  muted: "#6F947E",
  /** 更淡的輔助文字：空狀態、載入中、列表附註 */
  faint: "#9BB9A6",
  /** placeholder、箭頭等「還沒填 / 純裝飾」的文字 */
  placeholder: "#B9D2C2",
  /** 一般邊框（輸入框、選擇器、彈窗標題列分隔線） */
  border: "#E0EFE5",
  /** 卡片內部的淡分隔線 */
  borderSoft: "#EEF7F0",
  /** 虛線「新增」按鈕的邊框 */
  borderDashed: "#B9D2C2",
  /** 淡綠底：pill 選單底、hover 底、列尾小按鈕底 */
  surfaceSoft: "#EFF7F1",
  /** 選中態底色 */
  surfaceActive: "#E4F2E9",
  /** 更淡的 hover 底（清單列） */
  surfaceHover: "#F6FBF7",
  /** 品牌綠 */
  brand: "#3C9A62",
  /** 品牌綠漸層亮端 */
  brandLight: "#5EC183",
  /** 骨架色塊 */
  skeleton: "#DCECE1",

  /** 漲價——台灣看盤習慣漲紅跌綠，買菜的人看到紅色就知道「這個今天貴」。刻意不用正紅，
   *  用偏磚紅的橘紅，跟底下的刪除紅（negative）分得開。 */
  up: "#D4553F",
  upBg: "#FBEAE4",
  /** 跌價——對買菜的人是好消息。這個綠比品牌綠更深、彩度更低，不會跟按鈕的品牌綠搞混。 */
  down: "#2E8F6B",
  downBg: "#E2F3EA",

  /** 提醒：當季標籤、休市公告、估算值說明。 */
  warning: "#B5812B",
  warningBg: "#FAF1DD",
  /** 破壞性操作（刪除分類／項目）與錯誤訊息。 */
  negative: "#C94F6D",
  negativeBg: "#FCEDF1",
} as const;

export const gradient = {
  /** 主要行動按鈕的漸層 */
  primary: `linear-gradient(90deg, ${colors.brandLight}, ${colors.brand})`,
  /** 首頁主視覺卡（今日快報）的底色 */
  hero: "linear-gradient(135deg, #4FB278 0%, #3C9A62 52%, #2F7F55 100%)",
} as const;

export const shadow = {
  /** 清單卡片 */
  card: "0 6px 20px -8px rgba(60,154,98,0.22)",
  /** 價格卡（比清單卡再深一點） */
  cardStrong: "0 6px 20px -8px rgba(60,154,98,0.28)",
  /** 主要行動按鈕 */
  cta: "0 8px 20px -6px rgba(60,154,98,0.55)",
  /** 分頁選中態的小陰影 */
  pill: "0 2px 8px -2px rgba(60,154,98,0.35)",
  /** 浮起的圓形小按鈕（回到頂部） */
  float: "0 4px 12px -4px rgba(60,154,98,0.45)",
} as const;

export const radius = {
  /** 輸入框、選擇器、清單卡片 */
  field: "rounded-2xl",
  /** 價格卡、彈窗外框 */
  card: "rounded-[1.5rem]",
  /** 膠囊（按鈕、徽章、分頁） */
  pill: "rounded-full",
} as const;

/**
 * 字級規範——直接當 className 用。同一個層級的資訊永遠同一個大小。
 *
 * | token        | 大小        | 用在什麼 |
 * | ------------ | ----------- | -------- |
 * | heroTitle    | 24px bold   | 首頁主視覺的建議句 |
 * | pageTitle    | 20px bold   | 每一頁最上方的 h1 |
 * | priceBig     | 28px bold   | 詳情頁的今日價 |
 * | priceRow     | 17px bold   | 清單每一列的價格 |
 * | sectionTitle | 14px semi   | 區塊標題、卡片主要內容 |
 * | body         | 14px        | 清單主要內容、欄位裡選到的值 |
 * | label        | 12px medium | 欄位小標 |
 * | note         | 12px        | 備註說明 |
 * | hint         | 12px faint  | 空狀態、載入中、查無資料 |
 * | meta         | 11px        | 列表列的附註（市場、單位、產季） |
 * | badge        | 11px medium | 徽章（漲跌、划算、當季） |
 * | micro        | 10px        | 徽章裡最末端的附註 |
 *
 * 比搭乘車多出 `priceBig` 與 `priceRow` 兩階，因為這個工具的主角就是價格數字——清單列
 * 的價格如果跟品名一樣 14px，整頁看起來就是一片文字，看不出重點在哪。這兩階只准用在
 * 價格數字上，不要拿去放別的東西。
 *
 * **備註說明永遠不會比內文大。**
 */
export const text = {
  heroTitle: "text-2xl font-bold leading-snug",
  pageTitle: "text-xl font-bold text-[#2A4A36]",
  priceBig: "text-[28px] font-bold leading-none text-[#2A4A36]",
  priceRow: "text-[17px] font-bold leading-none text-[#2A4A36]",
  sectionTitle: "text-sm font-semibold text-[#2A4A36]",
  cardTitle: "text-sm font-semibold text-[#2A4A36]",
  body: "text-sm text-[#2A4A36]",
  bodyStrong: "text-sm font-medium text-[#2A4A36]",
  label: "text-xs font-medium text-[#6F947E]",
  note: "text-xs text-[#6F947E]",
  hint: "text-xs text-[#9BB9A6]",
  error: "text-xs text-[#C94F6D]",
  meta: "text-[11px] text-[#6F947E]",
  badge: "text-[11px] font-medium",
  micro: "text-[10px]",
  placeholder: "text-sm text-[#B9D2C2]",
} as const;

/** 間距規範——不要每個頁面自己湊 gap-2／gap-3／gap-5。 */
export const spacing = {
  /** 圖示格、徽章這種本來就密集的排列 */
  tight: "gap-2",
  /** 清單卡片之間 */
  list: "gap-2.5",
  /** 表單欄位之間 */
  field: "gap-3",
  /** 頁面區塊之間 */
  section: "gap-5",
} as const;

/**
 * 文案用詞表——同一件事在不同畫面要用同一個詞。
 *
 * 這個工具最容易長出同義詞的地方是「場所」與「我的菜籃」：價格來自哪裡可以被講成
 * 市場／通路／管道／場所，收藏可以被講成最愛／追蹤／常買／菜籃。先在這裡定死：
 *   - 三種價格來源統稱「場所」，個別名稱是傳統市場／超市量販／批發行情。
 *   - 使用者收藏的那一頁叫「我的菜籃」，第一層是「分類」，第二層是「項目」。
 */
export const copy = {
  /** 工具名稱。中文名在畫面上用，英文名只出現在網址與程式碼裡。 */
  appName: "菜鳥不買貴",
  appNameEn: "FreshWise",

  loading: "載入中…",
  searching: "搜尋中…",
  queryFailed: "查詢失敗，請稍後再試",
  failed: (what: string) => `${what}查詢失敗，請稍後再試`,

  save: "儲存",
  cancel: "取消",
  confirm: "確定",
  delete: "刪除",
  saved: "儲存成功",
  created: "新增成功",
  deleted: "刪除成功",
  addedToBasket: "已加入菜籃",
  removedFromBasket: "已從菜籃移除",

  /** 物件名稱（同一個東西只有一個叫法）。 */
  basket: "我的菜籃",
  group: "分類",
  entry: "項目",
  venue: "場所",
  market: "市場",

  /** 資料相關的固定句型。 */
  estimatedNote: "超市量販沒有公開訪價資料，這個數字是依零售價推估的參考值。",
  closedNote: "批發市場週一休市，顯示的是上一個交易日的行情。",
  /** 每一頁底部都放一次，讓使用者知道數字是誰訪的價。 */
  sourceNote: "行情來自農業部「農產品／漁產品／家禽交易行情」與臺中市公有零售市場每日訪價，每天更新一次。",
  /** 零售訪價只有臺中市公開完整資料，這件事要在設定頁與詳情頁說清楚。 */
  retailCoverageNote: "全台目前只有臺中市公開完整的零售市場訪價，其他縣市的傳統市場價格是用批發價推估的。",
} as const;
