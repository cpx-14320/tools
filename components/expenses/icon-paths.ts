// 記帳本的圖示路徑集中管理，做法比照搭乘車的 components/transit/icon-paths.ts：同一個
// 概念在不同檔案都指向同一個路徑字串，之後把圖檔放進 public/expenses/ 就會一次全部換成
// 真圖，不用逐一改程式碼。圖還沒放進去之前 IconImg 會用漸層佔位頂著，404 也不會壞畫面。
export const ICON_PATHS = {
  // 底部導覽列
  navHome: "/expenses/nav-home.png",
  navReports: "/expenses/nav-reports.png",
  navAssets: "/expenses/nav-assets.png",
  navPet: "/expenses/nav-pet.png",
  navSettings: "/expenses/nav-settings.png",

  // 帳戶之間搬錢（轉帳）——帳戶明細列表那一列的圖示。它不是「帳戶類型」，不會出現在
  // 類型選擇器裡，所以不走使用者可選的圖示那一套，固定掛在這裡。
  accountTransfer: "/expenses/account-transfer.png",

  // 養成頁場地下面那排入口（簽到／商店／衣服／背景）。本來商店跟背包是疊在場地右上角
  // 的兩顆小圖示，被背景圖吃掉不說，「換衣服」跟「換背景」還都藏在背包的頁籤底下。
  petNavCheckin: "/expenses/pet-nav-checkin.png",
  petNavShop: "/expenses/pet-nav-shop.png",
  petNavOutfit: "/expenses/pet-nav-outfit.png",
  petNavBackground: "/expenses/pet-nav-backpack.png",
  // 疊在場地下緣那排餵食鍵的按鈕框（食物圖會蓋在它上面）。
  petButtonBox: "/expenses/pet-buttonbox.png",
  // 星星幣。本來是 ⭐ emoji，但 emoji 在不同平台長得不一樣（iOS 立體、Android 扁平、
  // Windows 又是另一種），跟整頁的插畫風格對不上。
  petStar: "/expenses/pet-star.png",

  // 設定頁各項功能
  settingCategories: "/expenses/setting-category.png",
  settingBudgets: "/expenses/setting-budget.png",
  settingGoals: "/expenses/setting-savings.png",
  settingRecurring: "/expenses/setting-recurring.png",
  settingAssets: "/expenses/setting-assets.png",
  settingAccountTypes: "/expenses/setting-account.png",
  // AI 記帳那一區的開關列。命名跟上面那幾個設定項一致（setting-<功能>.png），
  // 圖還沒放進 public/expenses 之前 IconImg 會用漸層佔位，不會壞版。
  settingAi: "/expenses/setting-ai.png",
  // AI 解析完、還沒確認的那一批——借用帳單那張圖（那一列講的就是「一疊等著對的單據」）。
  aiDrafts: "/expenses/expenses-category-bill.png",
  settingExport: "/expenses/setting-export.png",
  settingImport: "/expenses/setting-import.png",
} as const;
