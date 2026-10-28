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

  // 設定頁各項功能
  settingCategories: "/expenses/setting-category.png",
  settingBudgets: "/expenses/setting-budget.png",
  settingGoals: "/expenses/setting-savings.png",
  settingRecurring: "/expenses/setting-recurring.png",
  settingAssets: "/expenses/setting-assets.png",
  settingAccountTypes: "/expenses/setting-account.png",
  settingExport: "/expenses/setting-export.png",
  settingImport: "/expenses/setting-import.png",
} as const;
