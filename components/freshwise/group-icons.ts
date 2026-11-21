// 我的菜籃「分類」可選的原創插畫。保留舊 key 相容已儲存的分類。
//
// 刻意只給十二個選項、不給一個完整的圖示搜尋器：分類通常就是「每週常買／火鍋／便當／
// 拜拜」這幾種，十二個圖示夠用了，而選項一多反而要花時間挑。順序照「最可能被選到」排，
// 第一個（購物籃）也是新增分類時的預設值。
export const GROUP_ICONS: readonly string[] = [
  "basket-shopping",
  "cart-shopping",
  "house",
  "book-open",
  "watering-can",
  "gear",
  "carrot",
  "apple-whole",
  "fish",
  "drumstick-bite",
  "egg",
  "wheat-awn",
];

export const DEFAULT_GROUP_ICON = GROUP_ICONS[0];
