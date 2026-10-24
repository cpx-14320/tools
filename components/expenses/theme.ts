// 記帳本自己的一份色票／字級規範，比照「搭乘車」工具實際用的色碼跟排版比例抽出來的——
// 搭乘車本身沒有共用 tokens 檔（刻意逐檔內嵌，不跨頁面 import 常數，見 home-view.tsx 的
// 說明），所以這裡另外為記帳本建一份，不是從搭乘車那邊 import。
// 只給記帳本模組（components/expenses/**、app/tools/expenses/**）用，不要讓登入／註冊／
// 管理後台／搭乘車去 import 這裡——那些共用 components/ui.tsx 那一套舊色票。

export const colors = {
  ink: "#4A3B7C", // 主要文字／標題
  muted: "#9C94C4", // 次要說明文字
  faint: "#B3ABD4", // 更淡的輔助文字（空狀態、載入中）
  border: "#ECE4FA", // 一般邊框
  borderSoft: "#F2EEFA", // 卡片內部分隔線
  surfaceSoft: "#F3EFFC", // 淡紫底（pill 選單底、hover 底）
  surfaceActive: "#EFEAFC", // 選中態底色
  brand: "#6F5FD6", // 品牌紫
  brandLight: "#8A7CEE", // 品牌紫漸層亮端
  positive: "#2FAE82",
  positiveBg: "#E3F6EC",
  negative: "#D1517E",
  negativeBg: "#FDEEF0",
} as const;

export const gradient = {
  primary: `linear-gradient(90deg, ${colors.brandLight}, ${colors.brand})`,
};

export const shadow = {
  card: "0 6px 20px -8px rgba(111,95,214,0.2)",
  cta: "0 8px 20px -6px rgba(111,95,214,0.6)",
};

/** 字級規範——直接當 className 字串用（比照既有 categoryColorClass 的用法），
 *  避免每個頁面自己決定標題/內文要多大、顏色深淺不一致。 */
export const text = {
  pageTitle: "text-xl font-bold text-[#4A3B7C]",
  sectionHeading: "text-sm font-semibold text-[#4A3B7C]",
  body: "text-sm font-medium text-[#4A3B7C]",
  /** 表單欄位的小標籤（Field 元件用）——跟 muted 同色但字重不同，不要混用。 */
  label: "text-xs font-medium text-[#9C94C4]",
  muted: "text-xs text-[#9C94C4]",
  faint: "text-xs text-[#B3ABD4]",
  statValue: "text-lg font-bold tabular-nums text-[#4A3B7C]",
} as const;

/** 「這個選項沒被選中」的統一表現：選到的那個保持原樣，其他的淡掉成灰灰的一片。
 *
 *  圖示選擇器（category-field-pickers.tsx）跟格子選擇器（option-grid.tsx）共用這一組
 *  class——兩邊都是「一排東西挑一個」，挑的手感要一樣。一個都還沒選的時候不要套，
 *  不然整排都是暗的，看起來像全部不能點。 */
export const unselectedOption = "opacity-40 hover:opacity-70";

/** 間距規範——卡片/區塊/欄位之間統一用這幾階，不要每個頁面自己湊 gap-3／gap-4／gap-5。
 *  card：同一張卡片內，標題跟內容、內容跟內容之間的間距。section：頁面裡一個區塊
 *  （一張卡片／一個列表）跟下一個區塊之間的間距。field：表單裡欄位跟欄位之間。
 *  tight：格子選擇器（分類格、帳戶類型格）這種本來就比較密集的排列。 */
export const spacing = {
  tight: "gap-1.5",
  card: "gap-3",
  field: "gap-4",
  section: "gap-4",
  page: "gap-4",
} as const;
