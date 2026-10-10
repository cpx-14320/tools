import { ICON_PATHS } from "./icon-paths";

/** 首頁上方文案／週末小旅行在「其他」頁編輯時，背景圖只能從這幾張裡挑，不開放使用者
 *  自行輸入任意路徑或上傳——避免存進資料庫的路徑打錯字、或指到不存在的檔案。 */
export const HERO_BANNER_IMAGE_OPTIONS: string[] = [ICON_PATHS.heroMainThink, ICON_PATHS.heroMainWork, ICON_PATHS.heroMainPlaygame];

export const WEEKEND_TRIP_IMAGE_OPTIONS: string[] = [ICON_PATHS.weekendTripBannerGetup, ICON_PATHS.weekendTripBannerTired];
