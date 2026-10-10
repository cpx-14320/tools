import { ICON_PATHS } from "./icon-paths";

/** 備忘錄可選的圖示清單，先用固定幾個 key 對應佔位圖——資料庫只存這裡的 key（見
 *  lib/memos.ts 的 icon 欄位），不存圖片路徑本身。之後使用者提供真的圖示時，只要把
 *  icon-paths.ts 裡對應的路徑換成真檔案，所有已經存在資料庫裡的備忘錄會自動套用新圖，
 *  不用跑資料遷移。 */
export const MEMO_ICON_OPTIONS: { key: string; icon: string }[] = [
  { key: "drinks", icon: ICON_PATHS.memoDrinks },
  { key: "ticket", icon: ICON_PATHS.memoTicket },
  { key: "work", icon: ICON_PATHS.memoWork },
  { key: "shop", icon: ICON_PATHS.memoShop },
  { key: "bill", icon: ICON_PATHS.memoBill },
  { key: "time", icon: ICON_PATHS.memoTime },
  { key: "map", icon: ICON_PATHS.memoMap },
  { key: "meal", icon: ICON_PATHS.memoMeal },
];

export function memoIconPath(key: string): string {
  return MEMO_ICON_OPTIONS.find((option) => option.key === key)?.icon ?? MEMO_ICON_OPTIONS[0].icon;
}
