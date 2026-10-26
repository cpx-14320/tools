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
import type { AccountKind } from "./account-types";

/** 沒有專屬圖檔時共用的佔位圖——收入分類、支出分類、帳戶類型三種情境共用這一張。 */
export const ICON_OTHER = "/expenses/category-other.png";

/** 「未分類」專用的圖——刪掉還有紀錄在用的分類時，那些紀錄會被收容到這裡
 *  （見 categories.server.ts 的 ensureUncategorized）。圖檔還沒放進 public/expenses，
 *  在那之前 IconAvatar 會顯示漸層佔位，不會壞版。 */
export const ICON_UNCATEGORIZED = "/expenses/category-uncategorized.png";

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

/** 支出主分類——內容跟順序就是實際用下來覺得好用的那一套，新帳號一進來就是這個狀態，
 *  不夠用或用不到都可以在「設定 › 收支分類」自己增刪、排序。
 *
 *  分得比以前細（原本是「購物」「生活」兩個大籃子，現在拆成電商購物／服飾／保養品／
 *  日用品／電話費／服務訂閱…）：大籃子記起來快，但月底看報表只會知道「生活花了八千」，
 *  想知道是日用品還是電話費就得一筆一筆翻。 */
export const PRESET_EXPENSE_CATEGORIES: PresetCategorySeed[] = [
  { name: "餐飲", icon: expenseCategoryIcon("food"), color: "a", children: ["早餐", "午餐", "晚餐"] },
  { name: "零食", icon: expenseCategoryIcon("dessert"), color: "f" },
  { name: "大眾交通", icon: expenseCategoryIcon("transport"), color: "a", children: ["月票"] },
  { name: "電商購物", icon: expenseCategoryIcon("shopping"), color: "c" },
  { name: "服飾", icon: expenseCategoryIcon("clothing"), color: "c", children: ["衣服", "包包"] },
  { name: "保養品", icon: expenseCategoryIcon("beauty"), color: "e" },
  { name: "日用品", icon: expenseCategoryIcon("life"), color: "d" },
  { name: "寵物", icon: expenseCategoryIcon("pet"), color: "c" },
  { name: "學習", icon: expenseCategoryIcon("education"), color: "d" },
  { name: "娛樂", icon: expenseCategoryIcon("entertainment"), color: "f" },
  { name: "社交", icon: expenseCategoryIcon("social"), color: "c" },
  { name: "旅遊", icon: expenseCategoryIcon("travel"), color: "e" },
  { name: "醫療", icon: expenseCategoryIcon("medical"), color: "a" },
  { name: "保險", icon: expenseCategoryIcon("insurance"), color: "b" },
  { name: "房租", icon: expenseCategoryIcon("rent"), color: "e" },
  { name: "繳稅", icon: expenseCategoryIcon("bill"), color: "a" },
  { name: "電話費", icon: expenseCategoryIcon("phone"), color: "c" },
  { name: "服務訂閱", icon: expenseCategoryIcon("subscription"), color: "b" },
  { name: "其他", icon: ICON_OTHER, color: "f" },
];

export const PRESET_INCOME_CATEGORIES: PresetCategorySeed[] = [
  // 薪水底下把各種名目都開成子項目：有子項目的大分類一定要選到項目才能記帳
  // （見 categories.ts 的 needsSubcategory），所以「這個月的薪水」要有「月薪」可以選；
  // 年終、分紅、各種節慶禮金則是一年只來幾次、但來的時候要分得開的那些。
  // 用不到的直接在設定頁刪掉就好。
  {
    name: "薪水",
    icon: incomeCategoryIcon("salary"),
    color: "a",
    children: ["月薪", "獎金", "年終", "分紅", "其他獎金", "端午禮金", "中秋禮金", "聖誕禮金", "勞動禮金", "春酒禮金", "生日禮金", "開工禮金", "特休換錢"],
  },
  { name: "投資", icon: incomeCategoryIcon("investment"), color: "b" },
  { name: "利息", icon: incomeCategoryIcon("interest"), color: "c" },
  { name: "其他", icon: ICON_OTHER, color: "d" },
];

export interface PresetAccountSeed {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: AccountKind;
  /** true 的話連帶建一個同名的帳戶——使用者一進來就有東西可以記帳，不用先建類型再建帳戶。
   *  只給最基本的現金跟銀行：定存、股票這些不是每個人都有，建一個餘額 0 的空帳戶放在
   *  資產總表上只是噪音，要用的時候在資產總表按右下角的＋就好。 */
  withAccount?: boolean;
}

/** 預設帳戶類型——資產負債兩邊都先建好常見的，省得每個人都要自己補一輪。
 *  用不到的可以在「設定 › 帳戶類型」刪掉（底下沒有帳戶在用才刪得掉）。 */
export const PRESET_ACCOUNTS: PresetAccountSeed[] = [
  { name: "現金錢包", icon: accountIcon("cash"), color: "a", kind: "asset", withAccount: true },
  { name: "銀行帳戶", icon: accountIcon("bank"), color: "b", kind: "asset", withAccount: true },
  { name: "定存", icon: accountIcon("fund"), color: "c", kind: "asset" },
  // 股票／黃金的圖還沒放進 public/expenses，先指到之後要放的檔名；圖檔補上去就會自己
  // 出現，在那之前 IconAvatar 會顯示漸層佔位，不會壞版。
  { name: "股票", icon: "/expenses/category-stocks.png", color: "d", kind: "asset" },
  { name: "黃金", icon: "/expenses/category-gold.png", color: "e", kind: "asset" },
  { name: "信用卡", icon: accountIcon("card"), color: "a", kind: "liability" },
  { name: "房貸", icon: accountIcon("home"), color: "b", kind: "liability" },
  { name: "車貸", icon: accountIcon("car"), color: "c", kind: "liability" },
  { name: "學貸", icon: accountIcon("education"), color: "d", kind: "liability" },
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

/** 同一張圖只留第一筆——選擇器是用 path 當 React key 的，重複的話畫面上會出現兩顆一模
 *  一樣的圖、而且 React 會噴 "Encountered two children with the same key"。 */
const dedupeByPath = (all: IconOption[]) => all.filter((opt, i) => all.findIndex((o) => o.path === opt.path) === i);

/** EXTRA_EXPENSE_ICONS 裡的甜點／服飾／保養品／寵物／電話費／帳單／訂閱，跟
 *  PRESET_EXPENSE_CATEGORIES 用的是同一張圖，所以這裡一定要去重。 */
export const EXPENSE_ICON_OPTIONS: IconOption[] = dedupeByPath([
  ...PRESET_EXPENSE_CATEGORIES.filter((c) => c.icon !== ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  ...EXTRA_EXPENSE_ICONS,
  { path: ICON_OTHER, label: "其他" },
]);

export const INCOME_ICON_OPTIONS: IconOption[] = dedupeByPath([
  ...PRESET_INCOME_CATEGORIES.filter((c) => c.icon !== ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  { path: ICON_OTHER, label: "其他" },
]);

/** 預設類型以外、只拿來給使用者挑的帳戶類型圖——有圖檔但不會自動建立對應的類型，
 *  想用哪一張自己在新增類型時挑。label 是給讀螢幕軟體用的（選擇器只排圖、不顯示
 *  文字），所以寫的是「這張圖畫的是什麼」。 */
const EXTRA_ACCOUNT_ICONS: IconOption[] = [
  { path: accountIcon("calendar"), label: "定存" },
  { path: accountIcon("business"), label: "店面" },
  { path: accountIcon("deduction"), label: "扣款" },
];

/** 預設類型的圖排前面、額外的接在後面，同一張圖只出現一次——預設類型現在涵蓋了信用卡、
 *  房貸、車貸、學貸，跟 EXTRA_ACCOUNT_ICONS 原本列的那幾張重疊，不去重的話選擇器裡會
 *  有兩顆一模一樣的圖。 */
export const ACCOUNT_ICON_OPTIONS: IconOption[] = dedupeByPath([
  ...PRESET_ACCOUNTS.map((a) => ({ path: a.icon, label: a.name })),
  ...EXTRA_ACCOUNT_ICONS,
  { path: ICON_OTHER, label: "其他" },
]);

/** 圖示字串是圖片路徑還是表情符號——舊資料（改版前使用者自己建的分類）存的是表情符號，
 *  新的預設資料跟選擇器存的是 `/expenses/...png` 路徑，顯示時要分開處理。 */
export function isIconPath(icon: string): boolean {
  return icon.startsWith("/");
}
