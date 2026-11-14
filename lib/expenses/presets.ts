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
// 還沒有專屬圖檔的分類（目前是全部子分類）指向共用的佔位圖 ICON_OTHER。至於「其他」
// 這個分類本身，有自己那一組的圖就用自己的（支出＝expenses-category-other.png）——
// 檔名帶著用途前綴，從檔案就看得出哪一區在用它，不會因為三個地方共用一張而不知道改了
// 會影響到誰。圖檔還沒放進 public/expenses 之前，IconAvatar 會顯示漸層佔位，404 不會
// 弄壞畫面。

import type { CategoryColor } from "./categories";
import type { AccountKind } from "./account-types";

/** 沒有專屬圖檔時共用的佔位圖——子分類、以及還沒有自己那張「其他」的情境用這一張。 */
export const ICON_OTHER = "/expenses/category-other.png";

/** 「未分類」專用的圖——刪掉還有紀錄在用的分類時，那些紀錄會被收容到這裡
 *  （見 categories.server.ts 的 ensureUncategorized）。圖檔還沒放進 public/expenses，
 *  在那之前 IconAvatar 會顯示漸層佔位，不會壞版。 */
export const ICON_UNCATEGORIZED = "/expenses/category-uncategorized.png";

/** 轉帳手續費記成支出時掛的分類（找不到就自動建，見 categories.server.ts 的
 *  ensureFeeCategory）。名稱是比對用的鍵，所以寫成常數而不是散在各處的字串。 */
export const FEE_CATEGORY_NAME = "手續費";
export const ICON_FEE = "/expenses/expenses-category-bill.png";

export const expenseCategoryIcon = (slug: string) => `/expenses/expenses-category-${slug}.png`;
export const incomeCategoryIcon = (slug: string) => `/expenses/income-category-${slug}.png`;
export const accountIcon = (slug: string) => `/expenses/account-${slug}.png`;

/** 支出的「其他」用支出自己那張（expenses-category-other.png），不跟收入、帳戶共用
 *  ICON_OTHER——同一張圖被三個地方用的話，要改其中一邊就得先確認會不會波及另外兩邊。
 *  收入跟帳戶目前還沒有對應的檔（income-category-other.png／account-other.png），
 *  補上之後照這一行的寫法各自指過去就好。 */
export const EXPENSE_ICON_OTHER = expenseCategoryIcon("other");

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
/** 支出分類。
 *
 *  **這一份是從實際在用的帳本（cpx1104）直接倒出來的**，不是另外想一套「大家應該會用
 *  到的分類」。理由很簡單：真的記了一年多的帳本才知道哪些分類會被用到、哪些只是想像
 *  出來的——原本的預設有「社交」「旅遊」「保險」這種多數人一年記不到三筆的分類，卻沒有
 *  「水費」「停車費」「手搖飲」這些每週都在花的。要重新產生這一份，用
 *  scripts/.dump-presets.mts 倒出來再轉成下面的格式即可。
 *
 *  分類結構的兩個原則（看得出來是從實際使用長出來的）：
 *  1. **會想分開看的就開子項目**：交通拆成定期票／捷運／高鐵…，因為「捷運 30」跟
 *     「高鐵 1490」在報表上的意義完全不同；混在一格就只剩一個加總。
 *  2. **金額規模差很多的不要混**：開車（加油、停車、保養）跟大眾交通分開、3C電器跟
 *     日用品分開——不然一筆兩萬的電腦會把那個月的日用品撞成平常的十倍。 */
export const PRESET_EXPENSE_CATEGORIES: PresetCategorySeed[] = [
  { name: "飲食", icon: expenseCategoryIcon("food"), color: "a", children: ["早餐", "午餐", "晚餐", "宵夜", "水果", "食材"] },
  { name: "飲料", icon: expenseCategoryIcon("beverage"), color: "a", children: ["手搖飲", "咖啡", "酒", "水"] },
  { name: "零嘴", icon: expenseCategoryIcon("dessert"), color: "f", children: ["甜食", "鹹食", "冰品"] },
  { name: "住家", icon: expenseCategoryIcon("furniture"), color: "e", children: ["電費", "水費", "瓦斯費", "管理費", "修繕費", "居家服務"] },
  { name: "交通", icon: expenseCategoryIcon("transport"), color: "a", children: ["定期票", "公車", "客運", "台鐵", "捷運", "高鐵", "計程車", "飛機"] },
  { name: "開車", icon: expenseCategoryIcon("transportation"), color: "a", children: ["加油費", "停車費", "過路費", "洗車", "換機油", "維修保養"] },
  { name: "服飾", icon: expenseCategoryIcon("clothing"), color: "c", children: ["上衣", "包包", "下衣", "鞋子"] },
  { name: "美妝保養", icon: expenseCategoryIcon("skincare"), color: "e" },
  { name: "寵物", icon: expenseCategoryIcon("pet"), color: "c" },
  { name: "娛樂", icon: expenseCategoryIcon("entertainment"), color: "f", children: ["電影", "遊戲", "音樂", "數位服務"] },
  { name: "學習", icon: expenseCategoryIcon("education"), color: "d", children: ["線上課程", "實體課程", "學費", "證照費"] },
  { name: "電信", icon: expenseCategoryIcon("internet"), color: "c", children: ["市內電話", "行動電話", "網路費", "電視費"] },
  { name: "服務訂閱", icon: expenseCategoryIcon("subscription"), color: "b" },
  { name: "稅金", icon: expenseCategoryIcon("bill"), color: "a", children: ["所得稅", "牌照稅", "燃料稅", "房屋稅", "地價稅"] },
  { name: "房租", icon: expenseCategoryIcon("rent"), color: "a" },
  { name: "日用品", icon: expenseCategoryIcon("life"), color: "a" },
  { name: "3C電器", icon: expenseCategoryIcon("electronics"), color: "r" },
  // 「其他」排最後：它是「挑不到合適的就先丟這裡」，夾在中間會變成一個被略過的選項。
  { name: "其他", icon: EXPENSE_ICON_OTHER, color: "f" },
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
  { name: "銀行帳戶", icon: accountIcon("bank"), color: "f", kind: "asset", withAccount: true },
  { name: "定存", icon: accountIcon("fund"), color: "c", kind: "asset", withAccount: true },
  // 股票／黃金的圖還沒放進 public/expenses，先指到之後要放的檔名；圖檔補上去就會自己
  // 出現，在那之前 IconAvatar 會顯示漸層佔位，不會壞版。
  { name: "股票", icon: "/expenses/category-stocks.png", color: "a", kind: "asset" },
  { name: "黃金", icon: "/expenses/category-gold.png", color: "f", kind: "asset" },
  { name: "信用卡", icon: accountIcon("card"), color: "a", kind: "liability" },
  { name: "房貸", icon: accountIcon("home"), color: "l", kind: "liability" },
  { name: "車貸", icon: accountIcon("car"), color: "h", kind: "liability" },
  { name: "學貸", icon: accountIcon("education"), color: "a", kind: "liability" },
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
 *  不顯示文字），所以寫的是「這張圖畫的是什麼」。 */
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
  // ── 帳單類再細分：水電瓦斯網路本來只有一張共用的「帳單」圖，分開記的人分不出哪筆是哪筆 ──
  { path: expenseCategoryIcon("electricity"), label: "電費" },
  { path: expenseCategoryIcon("water"), label: "水費" },
  { path: expenseCategoryIcon("gas"), label: "瓦斯費" },
  { path: expenseCategoryIcon("internet"), label: "網路費" },
  { path: expenseCategoryIcon("rental-home"), label: "租屋" },
  // ── 居家 ──
  { path: expenseCategoryIcon("furniture"), label: "家具" },
  { path: expenseCategoryIcon("cleaning"), label: "打掃" },
  { path: expenseCategoryIcon("housekeeping"), label: "清潔用品" },
  { path: expenseCategoryIcon("toilet-paper"), label: "衛生紙" },
  { path: expenseCategoryIcon("repair"), label: "維修" },
  { path: expenseCategoryIcon("gardening"), label: "園藝" },
  // ── 個人 ──
  { path: expenseCategoryIcon("skincare"), label: "保養品" },
  { path: expenseCategoryIcon("lipstick"), label: "彩妝" },
  { path: expenseCategoryIcon("bath"), label: "沐浴" },
  { path: expenseCategoryIcon("shoes"), label: "鞋子" },
  { path: expenseCategoryIcon("stethoscope"), label: "看診" },
  // ── 外出 ──
  { path: expenseCategoryIcon("coffee"), label: "咖啡" },
  { path: expenseCategoryIcon("store"), label: "商店" },
  { path: expenseCategoryIcon("movie"), label: "電影" },
  { path: expenseCategoryIcon("camera"), label: "攝影" },
  { path: expenseCategoryIcon("hotel"), label: "住宿" },
  { path: expenseCategoryIcon("flight-ticket"), label: "機票" },
  { path: expenseCategoryIcon("toll"), label: "過路費" },
  // ── 其他 ──
  { path: expenseCategoryIcon("work"), label: "工作" },
  { path: expenseCategoryIcon("stationery"), label: "文具" },
  { path: expenseCategoryIcon("gift"), label: "禮物" },
  { path: expenseCategoryIcon("donation"), label: "捐款" },
  { path: expenseCategoryIcon("discount"), label: "折扣" },
];

/** 預設收入分類以外、只拿來給使用者挑的收入圖（跟 EXTRA_EXPENSE_ICONS 同一個做法）。 */
const EXTRA_INCOME_ICONS: IconOption[] = [
  { path: incomeCategoryIcon("salary-envelope"), label: "薪資袋" },
];

/** 同一張圖只留第一筆——選擇器是用 path 當 React key 的，重複的話畫面上會出現兩顆一模
 *  一樣的圖、而且 React 會噴 "Encountered two children with the same key"。 */
const dedupeByPath = (all: IconOption[]) => all.filter((opt, i) => all.findIndex((o) => o.path === opt.path) === i);

/** EXTRA_EXPENSE_ICONS 裡的甜點／服飾／保養品／寵物／電話費／帳單／訂閱，跟
 *  PRESET_EXPENSE_CATEGORIES 用的是同一張圖，所以這裡一定要去重。 */
export const EXPENSE_ICON_OPTIONS: IconOption[] = dedupeByPath([
  ...PRESET_EXPENSE_CATEGORIES.filter((c) => c.icon !== EXPENSE_ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  ...EXTRA_EXPENSE_ICONS,
  // 「其他」永遠排在最後一個：它是「挑不到合適的就用這張」，不該出現在清單中間。
  { path: EXPENSE_ICON_OTHER, label: "其他" },
]);

export const INCOME_ICON_OPTIONS: IconOption[] = dedupeByPath([
  ...PRESET_INCOME_CATEGORIES.filter((c) => c.icon !== ICON_OTHER).map((c) => ({ path: c.icon, label: c.name })),
  ...EXTRA_INCOME_ICONS,
  { path: ICON_OTHER, label: "其他" },
]);

/** 預設類型以外、只拿來給使用者挑的帳戶類型圖——有圖檔但不會自動建立對應的類型，
 *  想用哪一張自己在新增類型時挑。label 是給讀螢幕軟體用的（選擇器只排圖、不顯示
 *  文字），所以寫的是「這張圖畫的是什麼」。
 *
 *  public/expenses/account-transfer.png 不在這裡：那張是「帳戶之間搬錢」那一列固定用的
 *  圖（見 icon-paths.ts），不是一種帳戶類型，收進來只會讓人挑到一個不存在的類型。 */
const EXTRA_ACCOUNT_ICONS: IconOption[] = [
  { path: accountIcon("calendar"), label: "定存" },
  { path: accountIcon("business"), label: "店面" },
  { path: accountIcon("deduction"), label: "扣款" },
  { path: accountIcon("savings"), label: "撲滿" },
  { path: accountIcon("savings-target"), label: "存錢目標" },
  { path: accountIcon("long-term-deposit"), label: "長期存款" },
  { path: accountIcon("mobile-payment"), label: "行動支付" },
  { path: accountIcon("safe"), label: "保險箱" },
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
