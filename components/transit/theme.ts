// 「搭乘車」工具的設計系統定義：色票、字級、間距、圓角、陰影、文案用詞，全部集中在這
// 一份。以前這個資料夾刻意把色碼／字級逐檔內嵌（每個頁面自己決定標題要多大、說明文字
// 要多淡），同一件事在不同檔案長得不一樣——說明文字有的 text-sm 有的 text-xs、同一顆
// 儲存按鈕在五個彈窗各寫一份漸層樣式。現在統一在這裡定義，畫面只引用這裡的 token，不
// 再自己湊數字。
//
// 使用範圍：components/transit/**、app/tools/transit/**。
// 不要讓記帳本（components/expenses/theme.ts 有自己一份）、登入／註冊／管理後台
// （components/ui.tsx 那套 globals.css 色票）來 import 這裡。
//
// 為什麼色碼寫死在這裡、不放進 globals.css 的 @theme：globals.css 那組 --ink／--muted
// 是別的工具在用的另一套深灰紫（#211D3B），搭乘車是比較亮的紫（#4A3B7C）。兩套混在
// 同一組變數名稱底下只會讓人改錯，所以這裡維持獨立一份，跟記帳本同一個做法。

export const colors = {
  /** 主要文字、標題、欄位值 */
  ink: "#4A3B7C",
  /** 次要說明文字、欄位小標 */
  muted: "#9C94C4",
  /** 更淡的輔助文字：空狀態、載入中、列表附註 */
  faint: "#B3ABD4",
  /** placeholder、箭頭等「還沒填 / 純裝飾」的文字 */
  placeholder: "#C7BFE6",
  /** 一般邊框（輸入框、下拉選單、彈窗標題列分隔線） */
  border: "#ECE4FA",
  /** 卡片內部的淡分隔線 */
  borderSoft: "#F2EEFA",
  /** 虛線「新增」按鈕的邊框 */
  borderDashed: "#C7BFE6",
  /** 淡紫底：pill 選單底、hover 底、列尾小按鈕底 */
  surfaceSoft: "#F3EFFC",
  /** 選中態底色（車種分頁、今天的日期） */
  surfaceActive: "#EFEAFC",
  /** 更淡的 hover 底（清單列） */
  surfaceHover: "#F8F6FD",
  /** 品牌紫 */
  brand: "#6F5FD6",
  /** 品牌紫漸層亮端 */
  brandLight: "#8A7CEE",
  /** 骨架灰（淡紫） */
  skeleton: "#E4DBF9",
  positive: "#2FAE82",
  positiveBg: "#E3F6EC",
  warning: "#D97A3D",
  warningBg: "#FDE7D8",
  negative: "#D1517E",
  negativeBg: "#FDEEF0",
} as const;

export const gradient = {
  /** 主要行動按鈕（搜尋班次、儲存、確定）的漸層 */
  primary: `linear-gradient(90deg, ${colors.brandLight}, ${colors.brand})`,
} as const;

export const shadow = {
  /** 清單卡片 */
  card: "0 6px 20px -8px rgba(111,95,214,0.2)",
  /** 班次卡片（比清單卡片再深一點） */
  cardStrong: "0 6px 20px -8px rgba(111,95,214,0.25)",
  /** 主要行動按鈕 */
  cta: "0 8px 20px -6px rgba(111,95,214,0.6)",
  /** 分頁選中態的小陰影 */
  pill: "0 2px 8px -2px rgba(111,95,214,0.4)",
  /** 浮起的圓形小按鈕（交換站點） */
  float: "0 4px 12px -4px rgba(111,95,214,0.4)",
} as const;

export const radius = {
  /** 輸入框、下拉選單、清單卡片 */
  field: "rounded-2xl",
  /** 班次卡片、彈窗外框 */
  card: "rounded-[1.5rem]",
  /** 圓角藥丸（按鈕、徽章、分頁） */
  pill: "rounded-full",
} as const;

/**
 * 字級規範——直接當 className 用。這一套就是「同一個層級的資訊永遠同一個大小」的依據，
 * 畫面上不要再出現第七、第八種大小。由大到小：
 *
 * | token         | 大小        | 用在什麼 |
 * | ------------- | ----------- | -------- |
 * | heroTitle     | 24px bold   | 首頁主視覺大標 |
 * | pageTitle     | 20px bold   | 每一頁最上方的 h1（我的行程／Ubike／設定） |
 * | sectionTitle  | 14px semi   | 頁面內的區塊標題（備忘錄、分類名稱） |
 * | body          | 14px        | 清單主要內容、欄位裡選到的值 |
 * | label         | 12px medium | 欄位小標（縣市、日期、時間） |
 * | note          | 12px        | 備註說明（真的在解釋一件事的句子） |
 * | hint          | 12px faint  | 空狀態、載入中、查無資料 |
 * | meta          | 11px        | 列表列的附註（距離、縣市、車程） |
 * | badge         | 11px medium | 徽章（路線色塊、到站時間、車次） |
 * | micro         | 10px        | 徽章裡的倒數、提醒時間這種最末端的附註 |
 *
 * 重點：**備註說明一律不會比內文大**。以前「載入中…」「還沒設定…」這類說明有的寫
 * text-sm（14px）、跟清單主要內容一樣大，看起來像正式內容而不是說明，這裡統一壓到
 * 12px 的 hint。
 */
export const text = {
  heroTitle: "text-2xl font-bold leading-snug",
  pageTitle: "text-xl font-bold text-[#4A3B7C]",
  sectionTitle: "text-sm font-semibold text-[#4A3B7C]",
  cardTitle: "text-sm font-semibold text-[#4A3B7C]",
  body: "text-sm text-[#4A3B7C]",
  bodyStrong: "text-sm font-medium text-[#4A3B7C]",
  label: "text-xs font-medium text-[#9C94C4]",
  note: "text-xs text-[#9C94C4]",
  hint: "text-xs text-[#B3ABD4]",
  error: "text-xs text-[#D1517E]",
  meta: "text-[11px] text-[#9C94C4]",
  badge: "text-[11px] font-medium",
  micro: "text-[10px]",
  placeholder: "text-sm text-[#C7BFE6]",
} as const;

/** 間距規範——區塊之間、欄位之間統一用這幾階，不要每個頁面自己湊 gap-2／gap-3／gap-5。 */
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
 * 文案用詞表——同一件事在不同畫面要用同一個詞。以前同時存在「載入中…」「查詢中…」
 * 「搜尋中…」「查詢附近站牌中…」四種寫法在講同一件事，也同時有「查詢失敗」「公車站序
 * 查詢失敗」「台鐵班次查詢失敗，請稍後再試」三種錯誤句型。規則：
 *
 * - **被動載入**（進頁面／打開彈窗就自己去抓的清單）＝「載入中…」
 * - **使用者主動查詢**（按了搜尋、打了字）＝「搜尋中…」
 * - **定位**＝「定位中…」
 * - 失敗訊息一律「<做什麼>失敗，請稍後再試」，不要有的帶「請稍後再試」有的不帶。
 */
export const copy = {
  loading: "載入中…",
  searching: "搜尋中…",
  locating: "定位中…",
  /** 一般查詢失敗。要指明是哪一種查詢時用 failed("公車站序")。 */
  queryFailed: "查詢失敗，請稍後再試",
  failed: (what: string) => `${what}查詢失敗，請稍後再試`,
  save: "儲存",
  cancel: "取消",
  confirm: "確定",
  delete: "刪除",
  saved: "儲存成功",
  created: "新增成功",
  deleted: "刪除成功",
  addedToTrip: "已加入行程",
  /** 「我的行程」的兩層物件名稱：分類（group）底下有行程（item）。 */
  group: "分類",
  tripItem: "行程",
  memo: "備忘錄",
} as const;
