import { ICON_PATHS } from "./icon-paths";

/** 常用行程可選的圖示清單，先用固定幾個 key 對應佔位圖，跟 memo-icons.ts 同一套做法——
 *  之後存的只會是這裡的 key，不是圖片路徑本身，換真圖只要改 icon-paths.ts 不用動已存的資料。 */
export const FREQUENT_TRIP_ICON_OPTIONS: { key: string; icon: string }[] = [
  { key: "home", icon: ICON_PATHS.tripHome },
  { key: "work", icon: ICON_PATHS.tripWork },
  { key: "school", icon: ICON_PATHS.tripSchool },
  { key: "other", icon: ICON_PATHS.tripOther },
];

export function frequentTripIconPath(key: string): string {
  return FREQUENT_TRIP_ICON_OPTIONS.find((option) => option.key === key)?.icon ?? FREQUENT_TRIP_ICON_OPTIONS[0].icon;
}
