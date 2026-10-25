// 純邏輯、不碰資料庫——實際寫進資料庫的流程在同資料夾的 presets.server.ts
// （見 categories.ts 開頭的說明）。
//
// 新帳號第一次進記帳本時要自動建立的「預設資料」：消費分類（含子分類）、帳戶類型、
// 以及各自一個現成的帳戶。原本是靠畫面上「套用常見分類／套用常見類型」兩顆按鈕讓使用者
// 自己點，但那等於每個人都要先做一次設定才能開始記帳；改成一進來就建好，按鈕也就一起
// 拿掉了。
//
// 這些預設資料會被標記成 isPreset，「清除全部資料」不會刪掉它們（見 api/expenses/reset）。
//
// ── 圖示 ──────────────────────────────────────────────────────────────────────
// 分類／帳戶類型的 icon 欄位存的是圖片路徑字串（不是表情符號），圖檔放在 public/expenses/。
// 命名規則跟底部導覽列（nav-*）、設定頁（setting-*）同一套「用途前綴 + 英文名稱」：
//   支出分類  expenses-category-<英文名>.png
//   收入分類  income-category-<英文名>.png
//   帳戶類型  account-<英文名>.png
// 還沒有專屬圖檔的分類（目前全部子分類、以及「其他」）一律指向同一張共用的佔位圖
// ICON_OTHER，三種情境共用一張，不另外各做一張。圖檔還沒放進 public/expenses 之前，
// IconAvatar 會顯示漸層佔位，404 不會弄壞畫面。

import type { CategoryColor } from "./categories";

/** 沒有專屬圖檔時共用的佔位圖——收入分類、支出分類、帳戶類型三種情境共用這一張。 */
export const ICON_OTHER = "/expenses/category-other.png";

export const expenseCategoryIcon = (slug: string) => `/expenses/expenses-category-${slug}.png`;
export const incomeCategoryIcon = (slug: string) => `/expenses/income-category-${slug}.png`;
export const accountIcon = (slug: string) => `/expenses/account-${slug}.png`;

export interface PresetCategorySeed {
  name: string;
  icon: string;
  color: CategoryColor;
  /** 子分類目前都沒有專屬圖檔，一律用共用的佔位圖（ICON_OTHER）。 */
  children?: string[];
}

/** 支出主分類。顏色在 a～f 六色之間輪，相鄰的分類不會同色。 */
export const PRESET_EXPENSE_CATEGORIES: PresetCategorySeed[] = [
  { name: "餐飲", icon: expenseCategoryIcon("food"), color: "a", children: ["早餐", "午餐", "晚餐"] },
  { name: "交通", icon: expenseCategoryIcon("transport"), color: "b", children: ["月票", "加油"] },
  { name: "購物", icon: expenseCategoryIcon("shopping"), color: "c", children: ["服裝", "保養品", "化妝品", "禮物"] },
  { name: "生活", icon: expenseCategoryIcon("life"), color: "d", children: ["日用品", "電話費", "水電費"] },
  { name: "房租", icon: expenseCategoryIcon("rent"), color: "e" },
  { name: "娛樂", icon: expenseCategoryIcon("entertainment"), color: "f" },
  { name: "醫療", icon: expenseCategoryIcon("medical"), color: "a" },
  { name: "保險", icon: expenseCategoryIcon("insurance"), color: "b" },
  { name: "社交", icon: expenseCategoryIcon("social"), color: "c" },
  { name: "學習", icon: expenseCategoryIcon("education"), color: "d" },
  { name: "旅遊", icon: expenseCategoryIcon("travel"), color: "e" },
  { name: "其他", icon: ICON_OTHER, color: "f" },
];

export const PRESET_INCOME_CATEGORIES: PresetCategorySeed[] = [
  // 各種節慶禮金、加班費這類項目不另外開子分類——它們是「某一筆薪水裡的一個項目」，
  // 記在那筆薪水的明細裡（見 lib/expenses/transactions.ts 的 breakdown）比拆成子分類精準。
  // 「月薪」排第一：有子項目的大分類現在一定要選到項目才能記帳（見 categories.ts 的
  // needsSubcategory），最常記的那一筆「這個月的薪水」要有地方放，底薪／勞保這些則是
  // 記在那一筆底下的明細。
  { name: "薪水", icon: incomeCategoryIcon("salary"), color: "a", children: ["月薪", "獎金", "年終", "分紅"] },
  { name: "投資", icon: incomeCategoryIcon("investment"), color: "b" },
  { name: "利息", icon: incomeCategoryIcon("interest"), color: "c" },
  { name: "其他", icon: ICON_OTHER, color: "d" },
];

export interface PresetAccountSeed {
  /** 帳戶類型名稱，同時也是一併建立的那個帳戶的名稱——預設就給一個同名的帳戶，
   *  使用者一進來就有東西可以記帳，不用先建類型再建帳戶。 */
  name: string;
  icon: string;
  color: CategoryColor;
}

/** 預設只建資產類型；負債（信用卡、貸款…）不是每個人都有，要用再自己新增。 */
export const PRESET_ACCOUNTS: PresetAccountSeed[] = [
  { name: "現金錢包", icon: accountIcon("cash"), color: "a" },
  { name: "銀行帳戶", icon: accountIcon("bank"), color: "b" },
];

/** 圖示選擇器可以選的圖——使用者新增自訂分類時從這裡挑，挑不到合適的就用「其他」那張
 *  佔位圖頂著，之後補上專屬圖檔再回來改。清單會隨著 public/expenses 裡的圖變多而加長，
 *  加圖的時候只要在這裡補一行，所有用到選擇器的畫面都會跟著出現新選項。 */
export interface IconOption {
  path: string;
  label: string;
}

/** 預設支出分類以外、只拿來給使用者挑的支出圖——有圖檔但不會自動建立對應的分類
 *  （跟 EXTRA_ACCOUNT_ICONS 同一個做法）。label 是給讀螢幕軟體用的（選擇器只排圖、
 *  不顯示文字），所以寫的是「這張圖畫的是什麼」。
 *
 *  public/expenses 裡還有一張 expenses-category-other.png，沒有收進來：它跟共用的
 *  ICON_OTHER（category-other.png）都是「…」，只差圓形跟圓角方形，排在同一個選擇器裡
 *  會變成兩個看起來一樣的「其他」，挑了也分不出差別。 */
const EXTRA_EXPENSE_ICONS: IconOption[] = [
  { path: expenseCategoryIcon("beverage"), label: "飲料" },
  { path: expenseCategoryIcon("dessert"), label: "甜點" },
  { path: expenseCategoryIcon("transportation"), label: "汽車" },
  { path: expenseCategoryIcon("clothing"), label: "服飾" },
  { path: expenseCategoryIcon("beauty"), label: "美容保養" },
  { path: expenseCategoryIcon("electronics"), label: "3C" },
  { path: expenseCategoryIcon("fitness"), label: "健身" },
  { path: expenseCategoryIcon("pet"), label: "寵物" },
  { path: expenseCategoryIcon("phone"), label: "電話費" },
  { path: expenseCategoryIcon("bill"), label: "帳單" },
  { path: expenseCategoryIcon("subscription"), label: "訂閱" },
];

export const EXPENSE_ICON_OPTIONS: IconOption[] = [
  ...PRESET_EXPENSE_CATEGORIES.filter((c) => c.icon !== ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  ...EXTRA_EXPENSE_ICONS,
  { path: ICON_OTHER, label: "其他" },
];

export const INCOME_ICON_OPTIONS: IconOption[] = [
  ...PRESET_INCOME_CATEGORIES.filter((c) => c.icon !== ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  { path: ICON_OTHER, label: "其他" },
];

/** 預設帳戶（現金錢包、銀行帳戶）以外、只拿來給使用者挑的帳戶類型圖——有圖檔但不會
 *  自動建立對應的帳戶，想用哪一張自己在新增類型時挑。label 是給讀螢幕軟體用的（選擇器
 *  只排圖、不顯示文字），所以寫的是「這張圖畫的是什麼」。 */
const EXTRA_ACCOUNT_ICONS: IconOption[] = [
  { path: accountIcon("card"), label: "信用卡" },
  { path: accountIcon("fund"), label: "基金" },
  { path: accountIcon("calendar"), label: "定存" },
  { path: accountIcon("home"), label: "房屋" },
  { path: accountIcon("car"), label: "汽車" },
  { path: accountIcon("education"), label: "學貸" },
  { path: accountIcon("business"), label: "店面" },
  { path: accountIcon("deduction"), label: "扣款" },
];

export const ACCOUNT_ICON_OPTIONS: IconOption[] = [
  ...PRESET_ACCOUNTS.map((a) => ({ path: a.icon, label: a.name })),
  ...EXTRA_ACCOUNT_ICONS,
  { path: ICON_OTHER, label: "其他" },
];

/** 圖示字串是圖片路徑還是表情符號——舊資料（改版前使用者自己建的分類）存的是表情符號，
 *  新的預設資料跟選擇器存的是 `/expenses/...png` 路徑，顯示時要分開處理。 */
export function isIconPath(icon: string): boolean {
  return icon.startsWith("/");
}
