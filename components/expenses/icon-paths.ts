// 記帳本的圖示路徑集中管理，做法比照搭乘車的 components/transit/icon-paths.ts：同一個
// 概念在不同檔案都指向同一個路徑字串，之後把圖檔放進 public/expenses/ 就會一次全部換成
// 真圖，不用逐一改程式碼。圖還沒放進去之前 IconImg 會用漸層佔位頂著，404 也不會壞畫面。
export const ICON_PATHS = {
  // 底部導覽列
  navHome: "/expenses/nav-home.png",
  navReports: "/expenses/nav-reports.png",
  navAssets: "/expenses/nav-assets.png",
  navSettings: "/expenses/nav-settings.png",

  // 設定頁各項功能
  settingCategories: "/expenses/setting-categories.png",
  settingBudgets: "/expenses/setting-budgets.png",
  settingGoals: "/expenses/setting-goals.png",
  settingRecurring: "/expenses/setting-recurring.png",
  settingAssets: "/expenses/setting-assets.png",
  settingAccountTypes: "/expenses/setting-account-types.png",
  settingExport: "/expenses/setting-export.png",
  settingImport: "/expenses/setting-import.png",
} as const;
