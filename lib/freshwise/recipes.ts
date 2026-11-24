// 固定食譜庫。純資料，沒有伺服器端依賴，client component 可以直接匯入。
//
// ## 為什麼是寫死的靜態資料，不是存在使用者的菜籃裡
//
// 食譜是**這個工具提供的內容**，不是使用者的資料。存進每個人的帳號底下，等於同一份
// 內容被複製 N 份：改一個錯字要寫遷移腳本，而且每個人看到的版本會不一樣。靜態資料
// 改完所有人立刻看到同一版。
//
// 使用者自己的部分只有一個數字——「我要煮幾人份」，那存在 `BasketGroup.servings`。
//
// ## 兩區的分界不是「是不是調味料」
//
// 蒜頭、薑、蔥、九層塔這幾樣目錄裡**有價格**，但它們在「蒜泥白肉」是主角、在「番茄
// 炒蛋」是配角。用規則自動分會分錯，所以由寫食譜的人用 `main` / `extra` 標。
//
//   main  ── 會按人份換算、有 `code` 的會算進成本
//   extra ── 具體份量按人份換算，「適量／少許」保留文字，一律不算錢
//
// ## 為什麼份量要存兩個欄位
//
// 食譜會寫「半顆洋蔥」「兩瓣蒜頭」「一根蔥」，那些是計數單位，沒辦法直接拿來乘單價。
// 所以 `display` 給人看、`qtyCatty` 給計算用，寫食譜的時候一起查好。只存一個的話，
// 要嘛畫面上出現「0.17 台斤洋蔥」這種沒人這樣講的話，要嘛算不出錢。

import { KG_PER_CATTY } from "./price";
import { ADDITIONAL_RECIPES } from "./recipes-extra";
import type { UnitKey } from "./types";

/** 公克只在食譜頁使用，不擴大其他頁面或帳號偏好的單位。 */
export type RecipeUnit = UnitKey | "g";

export interface RecipeIngredient {
  /** 目錄代碼。`null` ＝ 目錄裡沒有這樣東西（加工品、調味料），不算錢也連不到行情頁。 */
  code: string | null;
  /** 顯示名稱。`code` 有值時可以省略，畫面會用目錄裡的名字。 */
  name?: string;
  /** 給人看的份量：「半顆（約 100 公克）」「2 大匙」「適量」。 */
  display: string;
  /** 計價用的台斤數。`null` ＝ 算不出錢（調味料，或量小到算了也沒意義）。 */
  qtyCatty: number | null;
  /** 原食譜已提供的重量，作為顯示、計價與菜籃份量的共同基準。 */
  grams?: number;
  /** 可依人份換算的量；保留原有量匙、毫升、顆數等單位，不假設食材密度。 */
  measure?: { amount: number; unit: string; note?: string };
}

export interface Recipe {
  /** 對到 `DISH_ICONS` 的 icon，也是這張表的 key。 */
  dish: string;
  /** 料理名稱，跟 `DISH_ICONS` 的 name 一致——名稱比對要靠它。 */
  name: string;
  /** 食譜本身寫的是幾人份。使用者選別的人份時，兩區有明確數字的份量都按比例換算。 */
  baseServings: number;
  /** 大約要做多久（分鐘）。 */
  minutes: number;
  /** 主食材。 */
  main: RecipeIngredient[];
  /** 另外準備的：調味料與目錄裡沒有價格的加工品。 */
  extra: RecipeIngredient[];
  /** 作法，一步一行。 */
  steps: string[];
  tip?: string;
}

/* ─────────────────────────── 食譜 ─────────────────────────── */

/** 第一批 10 道。刻意涵蓋不同情況，才能一次驗完結構：
 *  蚵仔煎／麻婆豆腐有沒價格的主料、蒜炒空心菜的蒜頭是主角、蘿蔔排骨湯是計數單位、
 *  滷肉飯的 extra 比 main 還多、海鮮粥對應預設菜籃裡份量是空的那一組。 */
const LIST: Recipe[] = [
  {
    dish: "dish-pineapple-shrimp",
    name: "鳳梨蝦球",
    baseServings: 4,
    minutes: 25,
    main: [
      { code: "HB3", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "GA2", display: "四分之一顆（約 200 公克）", qtyCatty: 0.33, grams: 200, measure: { amount: 0.25, unit: "顆" } },
    ],
    extra: [
      { code: null, name: "美乃滋", display: "4 大匙", qtyCatty: null, measure: { amount: 4, unit: "大匙" } },
      { code: null, name: "煉乳", display: "1 小匙", qtyCatty: null, measure: { amount: 1, unit: "小匙" } },
      { code: null, name: "地瓜粉", display: "半碗", qtyCatty: null, measure: { amount: 0.5, unit: "碗" } },
      { code: null, name: "鹽", display: "少許", qtyCatty: null },
      { code: null, name: "米酒", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "熟白芝麻", display: "少許", qtyCatty: null },
    ],
    steps: [
      "白蝦去殼留尾，背部劃一刀挑掉腸泥，用鹽和米酒抓醃十分鐘。",
      "鳳梨切塊；蝦子擦乾後沾一層薄薄的地瓜粉。",
      "油溫七分熱下蝦子，炸到外殼酥脆、顏色轉紅就撈起瀝油。",
      "美乃滋加煉乳拌勻，和炸好的蝦球、鳳梨塊輕輕拌在一起。",
      "盛盤，撒上熟白芝麻。",
    ],
    tip: "鳳梨先用鹽水泡一下不會咬舌。拌醬要在上桌前才拌，先拌會軟掉。",
  },
  {
    dish: "dish-mixed-seafood-stir-fry",
    name: "炒三鮮",
    baseServings: 4,
    minutes: 20,
    main: [
      { code: "HB7", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "HB3", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "HB4", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "FB3", display: "半根（約 80 公克）", qtyCatty: 0.13, grams: 80, measure: { amount: 0.5, unit: "根" } },
    ],
    extra: [
      { code: null, name: "蒜頭", display: "3 瓣", qtyCatty: null, measure: { amount: 3, unit: "瓣" } },
      { code: null, name: "薑", display: "3 片", qtyCatty: null, measure: { amount: 3, unit: "片" } },
      { code: null, name: "米酒", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "鹽", display: "適量", qtyCatty: null },
      { code: null, name: "白胡椒", display: "少許", qtyCatty: null },
      { code: null, name: "太白粉水", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
    ],
    steps: [
      "文蛤泡鹽水吐沙兩小時；花枝切花刀再切塊，白蝦去殼去腸泥。",
      "燒一鍋水，花枝和蝦子分別汆燙十秒就撈起，不要燙過頭。",
      "熱鍋下油，爆香蒜片和薑片，下胡蘿蔔片炒軟。",
      "下文蛤，嗆米酒蓋鍋燜到開口。",
      "放回花枝和蝦子，用鹽和白胡椒調味，淋太白粉水勾薄芡即可。",
    ],
    tip: "海鮮先燙再回鍋是為了讓每樣東西都剛好熟——一起炒的話蝦子老了文蛤還沒開。",
  },
  {
    dish: "dish-seafood-congee",
    name: "海鮮粥",
    baseServings: 4,
    minutes: 40,
    main: [
      { code: "RA1", display: "1.5 杯（約 270 公克）", qtyCatty: 0.45, grams: 270, measure: { amount: 1.5, unit: "杯" } },
      { code: "HB4", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "HB3", display: "半台斤（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "FB3", display: "半根（約 80 公克）", qtyCatty: 0.13, grams: 80, measure: { amount: 0.5, unit: "根" } },
    ],
    extra: [
      { code: null, name: "薑絲", display: "1 小把", qtyCatty: null, measure: { amount: 1, unit: "小把" } },
      { code: null, name: "芹菜末", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "油蔥酥", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "鹽", display: "適量", qtyCatty: null },
      { code: null, name: "白胡椒", display: "適量", qtyCatty: null },
      { code: null, name: "香油", display: "少許", qtyCatty: null },
    ],
    steps: [
      "米洗淨，加八倍的水下鍋，大火滾後轉小火煮二十分鐘。",
      "文蛤吐沙洗淨，白蝦去殼去腸泥，胡蘿蔔切細丁。",
      "粥底煮到米粒開花，下胡蘿蔔丁和薑絲再煮五分鐘。",
      "下文蛤煮到開口，再下蝦子煮一分鐘就關火。",
      "用鹽和白胡椒調味，撒芹菜末、油蔥酥，滴幾滴香油。",
    ],
    tip: "蝦子最後下、關火前一分鐘就好。煮久了會縮成一小團。",
  },
  {
    dish: "dish-oyster-omelet",
    name: "蚵仔煎",
    baseServings: 2,
    minutes: 15,
    main: [
      { code: "HB5", display: "四分之一台斤（約 150 公克）", qtyCatty: 0.25, grams: 150 },
      { code: "EA1", display: "2 顆", qtyCatty: 0.18, grams: 108, measure: { amount: 2, unit: "顆" } },
      { code: "FA5", display: "1 小把（約 80 公克）", qtyCatty: 0.13, grams: 80, measure: { amount: 1, unit: "小把" } },
    ],
    extra: [
      { code: null, name: "地瓜粉", display: "4 大匙", qtyCatty: null, measure: { amount: 4, unit: "大匙" } },
      { code: null, name: "太白粉", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "水", display: "150 毫升", qtyCatty: null, measure: { amount: 150, unit: "毫升" } },
      { code: null, name: "海山醬", display: "適量", qtyCatty: null },
      { code: null, name: "鹽", display: "少許", qtyCatty: null },
    ],
    steps: [
      "地瓜粉、太白粉加水調成粉漿，靜置十分鐘。",
      "牡蠣用鹽水輕輕沖洗，瀝乾；空心菜切段。",
      "平底鍋熱油，下牡蠣煎到邊緣捲起。",
      "倒入粉漿鋪平，等邊緣變透明後打蛋在上面，用鏟子戳散。",
      "鋪上空心菜，翻面煎到兩面微焦，起鍋淋海山醬。",
    ],
    tip: "粉漿不要調太稠，倒下去要能自己攤平。牡蠣用沖的不要用搓的，會破。",
  },
  {
    dish: "dish-tomato-eggs",
    name: "番茄炒蛋",
    baseServings: 2,
    minutes: 12,
    main: [
      { code: "FC3", display: "2 顆（約 300 公克）", qtyCatty: 0.5, grams: 300, measure: { amount: 2, unit: "顆" } },
      { code: "EA1", display: "3 顆", qtyCatty: 0.27, grams: 162, measure: { amount: 3, unit: "顆" } },
    ],
    extra: [
      { code: null, name: "青蔥", display: "1 根", qtyCatty: null, measure: { amount: 1, unit: "根" } },
      { code: null, name: "糖", display: "1 小匙", qtyCatty: null, measure: { amount: 1, unit: "小匙" } },
      { code: null, name: "鹽", display: "適量", qtyCatty: null },
      { code: null, name: "番茄醬", display: "1 大匙（可不加）", qtyCatty: null, measure: { amount: 1, unit: "大匙", note: "可不加" } },
    ],
    steps: [
      "番茄切塊，蛋打散加一點鹽拌勻。",
      "熱鍋多下一點油，倒入蛋液，半凝固時就先盛起來。",
      "原鍋下番茄炒到出汁、邊緣軟爛。",
      "加糖和鹽調味，喜歡酸甜一點可以加番茄醬。",
      "倒回炒蛋，輕輕拌兩下就起鍋，撒蔥花。",
    ],
    tip: "蛋要先盛起來再回鍋，才會是嫩的。加糖不是為了甜，是為了壓番茄的酸。",
  },
  {
    dish: "dish-three-cup-chicken",
    name: "三杯雞",
    baseServings: 4,
    minutes: 30,
    main: [
      { code: "MC2", display: "1 台斤（約 600 公克）", qtyCatty: 1, grams: 600 },
      { code: "FE3", display: "1 大把", qtyCatty: 0.08, grams: 48, measure: { amount: 1, unit: "大把" } },
      { code: "FB7", display: "1 小塊（約 30 公克）", qtyCatty: 0.05, grams: 30 },
      { code: "FB6", display: "1 整球（約 50 公克）", qtyCatty: 0.08, grams: 50 },
    ],
    extra: [
      { code: null, name: "黑麻油", display: "3 大匙", qtyCatty: null, measure: { amount: 3, unit: "大匙" } },
      { code: null, name: "醬油膏", display: "3 大匙", qtyCatty: null, measure: { amount: 3, unit: "大匙" } },
      { code: null, name: "米酒", display: "半杯", qtyCatty: null, measure: { amount: 0.5, unit: "杯" } },
      { code: null, name: "冰糖", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "辣椒", display: "1 根（可不加）", qtyCatty: null, measure: { amount: 1, unit: "根", note: "可不加" } },
    ],
    steps: [
      "雞腿剁塊，用熱水汆燙三十秒去血水，撈起沖乾淨。",
      "冷鍋下黑麻油，小火把薑片煸到邊緣捲曲、顏色轉深。",
      "下蒜瓣和辣椒炒香，轉大火下雞肉煎到表面上色。",
      "加醬油膏、冰糖和米酒，蓋鍋轉中小火燜十五分鐘。",
      "開蓋收汁到濃稠，關火前放九層塔拌兩下就起鍋。",
    ],
    tip: "麻油要冷鍋下、小火煸薑，熱鍋下會苦。九層塔最後放，進鍋超過十秒就黑了。",
  },
  {
    dish: "dish-mapo-tofu",
    name: "麻婆豆腐",
    baseServings: 3,
    minutes: 20,
    main: [
      { code: "MA5", display: "四分之一台斤（約 150 公克）", qtyCatty: 0.25, grams: 150 },
      { code: "FB4", display: "2 根", qtyCatty: 0.05, grams: 30, measure: { amount: 2, unit: "根" } },
    ],
    extra: [
      { code: null, name: "嫩豆腐", display: "1 盒（約 400 公克）", qtyCatty: null, grams: 400, measure: { amount: 1, unit: "盒" } },
      { code: null, name: "豆瓣醬", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "醬油", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "花椒粉", display: "1 小匙", qtyCatty: null, measure: { amount: 1, unit: "小匙" } },
      { code: null, name: "蒜末", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "太白粉水", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "高湯或水", display: "1 碗", qtyCatty: null, measure: { amount: 1, unit: "碗" } },
    ],
    steps: [
      "豆腐切 2 公分見方，用加鹽的熱水泡五分鐘再瀝乾——這樣炒的時候不容易散。",
      "熱鍋下油，豬絞肉炒到出油、變金黃。",
      "下蒜末和豆瓣醬，小火炒到油變紅。",
      "加高湯和醬油煮滾，輕輕放入豆腐，小火煮三分鐘不要攪。",
      "分兩次淋太白粉水勾芡，撒花椒粉和蔥花。",
    ],
    tip: "豆腐進鍋後用推的不要用炒的，鍋鏟一翻就碎。花椒粉起鍋才撒，久煮會苦。",
  },
  {
    dish: "dish-garlic-water-spinach",
    name: "蒜炒空心菜",
    baseServings: 3,
    minutes: 8,
    main: [
      { code: "FA5", display: "1 把（約 300 公克）", qtyCatty: 0.5, grams: 300 },
      { code: "FB6", display: "5 瓣（約 25 公克）", qtyCatty: 0.04, grams: 25, measure: { amount: 5, unit: "瓣" } },
    ],
    extra: [
      { code: null, name: "鹽", display: "適量", qtyCatty: null },
      { code: null, name: "米酒", display: "1 大匙", qtyCatty: null, measure: { amount: 1, unit: "大匙" } },
      { code: null, name: "辣椒", display: "1 根（可不加）", qtyCatty: null, measure: { amount: 1, unit: "根", note: "可不加" } },
    ],
    steps: [
      "空心菜洗淨，梗和葉分開切段——梗比較耐煮，要先下。",
      "蒜頭拍扁切末。",
      "大火熱鍋，多下一點油，爆香蒜末。",
      "先下梗炒三十秒，再下葉子，嗆米酒。",
      "加鹽快速翻炒二十秒就起鍋。",
    ],
    tip: "這道菜從下鍋到起鍋不到一分鐘。鍋要夠熱、動作要快，慢了就出水變黑。",
  },
  {
    dish: "dish-radish-pork-soup",
    name: "蘿蔔排骨湯",
    baseServings: 4,
    minutes: 60,
    main: [
      { code: "FB2", display: "1 根（約 600 公克）", qtyCatty: 1, grams: 600, measure: { amount: 1, unit: "根" } },
      { code: "MA6", display: "1 台斤（約 600 公克）", qtyCatty: 1, grams: 600 },
      { code: "FB7", display: "4 片", qtyCatty: 0.03, grams: 18, measure: { amount: 4, unit: "片" } },
    ],
    extra: [
      { code: null, name: "鹽", display: "適量", qtyCatty: null },
      { code: null, name: "米酒", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "白胡椒", display: "少許", qtyCatty: null },
      { code: null, name: "芹菜末", display: "1 大匙（可不加）", qtyCatty: null, measure: { amount: 1, unit: "大匙", note: "可不加" } },
    ],
    steps: [
      "排骨冷水下鍋，煮滾後撈掉浮沫，整鍋倒掉重新洗淨。",
      "白蘿蔔去皮切大塊——塊切大一點才不會煮到化掉。",
      "排骨、蘿蔔、薑片放進鍋裡，加水蓋過食材，淋米酒。",
      "大火煮滾後轉小火，蓋鍋燉四十五分鐘。",
      "起鍋前用鹽和白胡椒調味，撒芹菜末。",
    ],
    tip: "汆燙那一步不要省，湯才會清。蘿蔔挑沉手、表皮光滑的，空心的煮起來沒味道。",
  },
  {
    dish: "dish-braised-pork-rice",
    name: "滷肉飯",
    baseServings: 4,
    minutes: 90,
    main: [
      { code: "MA3", display: "1 台斤（約 600 公克）", qtyCatty: 1, grams: 600 },
      { code: "RA1", display: "2 杯（約 360 公克）", qtyCatty: 0.6, grams: 360, measure: { amount: 2, unit: "杯" } },
      { code: "FJ6", display: "6 顆（約 50 公克）", qtyCatty: 0.08, grams: 50, measure: { amount: 6, unit: "顆" } },
      { code: "EA1", display: "4 顆", qtyCatty: 0.36, grams: 216, measure: { amount: 4, unit: "顆" } },
    ],
    extra: [
      { code: null, name: "醬油", display: "半杯", qtyCatty: null, measure: { amount: 0.5, unit: "杯" } },
      { code: null, name: "米酒", display: "半杯", qtyCatty: null, measure: { amount: 0.5, unit: "杯" } },
      { code: null, name: "冰糖", display: "2 大匙", qtyCatty: null, measure: { amount: 2, unit: "大匙" } },
      { code: null, name: "五香粉", display: "1 小匙", qtyCatty: null, measure: { amount: 1, unit: "小匙" } },
      { code: null, name: "白胡椒", display: "1 小匙", qtyCatty: null, measure: { amount: 1, unit: "小匙" } },
      { code: null, name: "八角", display: "2 顆", qtyCatty: null, measure: { amount: 2, unit: "顆" } },
      { code: null, name: "水", display: "蓋過食材", qtyCatty: null },
    ],
    steps: [
      "豬五花切成 1 公分寬的長條，不要切太細，滷完會縮。",
      "紅蔥頭切片，用中小火慢慢煸成金黃色的油蔥酥，連油一起留著。",
      "另起鍋把五花條煸到出油、表面微焦。",
      "加醬油、米酒、冰糖炒到上色，倒入油蔥酥連油、八角、五香粉。",
      "加水蓋過食材，小火滷一小時；雞蛋另外煮熟剝殼，最後半小時放進去一起滷。",
      "白飯盛碗，淋上滷肉和滷汁，擺一顆滷蛋。",
    ],
    tip: "紅蔥頭是這道菜的靈魂，自己煸的油蔥酥跟買的差很多。火要小，一焦就苦。",
  },
];

const ALL_RECIPES = [...LIST, ...ADDITIONAL_RECIPES];

/** 以 `DISH_ICONS` 的 icon 當 key。 */
export const RECIPES: Record<string, Recipe> = Object.fromEntries(ALL_RECIPES.map((r) => [r.dish, r]));

export const RECIPE_COUNT = ALL_RECIPES.length;

/* ─────────────────────── 查找與換算 ─────────────────────── */

/**
 * 這個分類對應到哪一道食譜。
 *
 * 兩層判斷，蓋住兩種情況：
 *   1. **名稱完全等於某道料理** —— 選了鳳梨蝦球的圖卻改名叫「三杯雞」，使用者要的是
 *      三杯雞。名稱是他主動打的，優先。
 *   2. **icon 對應** —— 名稱叫「週末加菜」但選了鳳梨蝦球的圖，那就是要做鳳梨蝦球。
 *
 * 兩層都沒命中就是沒有食譜。「今天買菜」「冰箱補貨」這種自訂分類既不是料理名、
 * icon 也是通用的，會落在這裡——那正是我們要擋掉的。
 */
export function recipeForGroup(group: { name: string; icon: string }): Recipe | undefined {
  const byName = ALL_RECIPES.find((r) => r.name === group.name.trim());
  if (byName) return byName;
  return RECIPES[group.icon];
}

/**
 * 食譜圖示要長什麼樣子。
 *
 * `pending` 跟 `none` 要分開：前者是「這道菜我們還沒寫」，後者是「這本來就不是料理」。
 * 兩種都反灰，但 tooltip 不一樣——寫「還沒有食譜」會讓選了宮保雞丁的人以為是自己
 * 少做了什麼。
 */
export function recipeStatus(group: { name: string; icon: string }): "ready" | "pending" | "none" {
  if (recipeForGroup(group)) return "ready";
  return group.icon.startsWith("dish-") ? "pending" : "none";
}

/** 把台斤份量按人份換算，保留精度，避免少量香料與小份料理被提前四捨五入。 */
export function scaleQty(qtyCatty: number | null, recipe: Recipe, servings: number): number | null {
  if (qtyCatty === null) return null;
  const scaled = (qtyCatty * servings) / recipe.baseServings;
  return Math.round(scaled * 1000000) / 1000000;
}

/** 公克與計價份量沿用同一份原始食譜資料。 */
export function ingredientQty(ing: RecipeIngredient, recipe: Recipe, servings: number): number | null {
  return scaleQty(ing.grams !== undefined && ing.code ? ing.grams / (KG_PER_CATTY * 1000) : ing.qtyCatty, recipe, servings);
}

const quantityNumber = (n: number) => new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(n);

export function recipeWeightText(grams: number, unit: RecipeUnit): string {
  const divisor = unit === "catty" ? KG_PER_CATTY * 1000 : unit === "kg" ? 1000 : 1;
  const label = unit === "catty" ? "台斤" : unit === "kg" ? "公斤" : "公克";
  const amount = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: unit === "g" ? 1 : 4 }).format(grams / divisor);
  return `${amount} ${label}`;
}

/** 數字份量跟著人份縮放；未量化的「適量、少許、蓋過食材」維持原說明。 */
export function ingredientQuantityText(ing: RecipeIngredient, recipe: Recipe, servings: number, unit: RecipeUnit = "g"): string {
  const factor = servings / recipe.baseServings;
  const weight = ing.grams === undefined ? undefined : recipeWeightText(ing.grams * factor, unit);
  const measure = ing.measure;
  const amount = measure ? `${quantityNumber(measure.amount * factor)} ${measure.unit}` : undefined;
  const note = measure?.note ? `（${measure.note}）` : "";
  if (ing.code && weight !== undefined) return `${weight}${amount ? `（約 ${amount}）` : ""}${note}`;
  if (amount) return `${amount}${weight !== undefined ? `（約 ${weight}）` : ""}${note}`;
  if (weight !== undefined) return weight;
  return ing.display;
}

/** 照指定人份算這道菜的食材成本（只算 main 區裡有行情的）。 */
export function recipeCost(
  recipe: Recipe,
  servings: number,
  priceOf: (code: string) => number | undefined,
): { total: number; counted: number; skipped: number } {
  let total = 0;
  let counted = 0;
  let skipped = 0;
  for (const ing of recipe.main) {
    const qty = ingredientQty(ing, recipe, servings);
    const price = ing.code ? priceOf(ing.code) : undefined;
    if (qty === null || price === undefined) {
      skipped++;
      continue;
    }
    total += qty * KG_PER_CATTY * price;
    counted++;
  }
  return { total: Math.round(total), counted, skipped };
}
