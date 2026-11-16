// 純邏輯、不碰資料庫——CRUD 跟獎勵結算在同資料夾的 pet.server.ts（見 categories.ts 開頭）。
//
// ── 養成功能的設計原則 ────────────────────────────────────────────────────────
// 貨幣（星星幣）只從「好的記帳行為」來，不從淨資產或消費金額來。理由是：淨資產會因為
// 一筆大額醫療費、年繳保費而掉下去，如果角色跟著變虛弱，等於在懲罰誠實記帳，甚至會
// 讓人乾脆不記那筆大支出——那跟記帳工具的目的正好相反。所以：
//   星星幣 ← 每天有記帳、連續記帳、上個月守住預算（這些都是使用者能主動控制的行為）
//   淨資產 → 只拿來算「理財段位」，純展示、不能換東西
// 這樣淨資產還是有參與感，但不會變成懲罰。

/** 「狀態」是看的、不是穿的：目前只有孵化那一段動畫，Lv.10 之後自動解鎖（不用買），
 *  在背包裡點了會在預覽區重播一次。 */
export type PetItemKind = "食物" | "服裝" | "背景" | "狀態";

/** 商店圖片路徑——跟 presets.ts 的 expenseCategoryIcon 同一套「用途前綴＋英文名」規則。
 *  id 本身已經是英文 slug（food-cake、bg-beach…），直接接在 `pet-` 後面就好：
 *  `pet-food-cake.png`、`pet-bg-beach.png`。原本多夾一段 `item`（pet-item-food-cake）
 *  是贅字，檔名長又難掃。圖檔還沒放進 public/expenses 之前 IconImg 會用漸層佔位，
 *  404 不會破版。（服裝不走這條規則，見下面的 petModelSprite。） */
export const petItemImage = (id: string) => `/expenses/pet-${id}.png`;

/** 服裝的圖就是角色那套造型的待機精靈圖本身（intj-model-laboratory-idle.png…），
 *  不另外出一張商店用的縮圖：商店格子直接裁第一格來顯示（見 petItemThumb），
 *  換上之後場地裡播的也是同一張，看到的跟穿起來的保證一致。 */
export const petModelSprite = (slug: string) => `/expenses/intj-model-${slug}-idle.png`;

/** 蛋（出生造型）的兩張圖。它不走 petModelSprite 的命名——蛋不是「某一套衣服」，
 *  是孵化前的樣子，圖也是另外一組。 */
const EGG_IDLE_SPRITE = "/expenses/egg-state.png";
const EGG_EATING_SPRITE = "/expenses/egg-eating.png";

/** 針對特定食物畫的專屬吃東西動畫，key 是食物的 item id。現在十二種食物都有自己的
 *  一張了（最早只有蛋糕，其餘十一張是陸續補上的）。
 *
 *  **孵化後的造型沒有「共用吃東西圖」這條退路**：以前還沒畫專屬動畫的食物會退回一張
 *  所有造型共用的 intj-eating.png，那張圖已經淘汰、不再放進 public/expenses。萬一之後
 *  又新增了這裡沒列到的食物，吃的時候會維持角色待機姿勢不動（見 petOutfitSprite），
 *  不會播任何「吃東西」動畫，也不會去讀一張不存在的圖——圖畫好之後在這裡補一行就會
 *  自動生效，不用改任何呼叫端的程式碼。
 *
 *  **規格跟其他精靈圖不一樣**：這裡是單列 7 格（3500×500，一格 500×500），演兩輪再回到
 *  待機；其他精靈圖（待機、孵化、動作狀態）是 7 欄 × 3 列＝21 格、演一輪。兩種格式
 *  混用是因為這批圖是之後才陸續補的，各種食物的咀嚼動作只需要一個短循環，重用 21 格
 *  的規格只會逼著每張圖多畫 14 格用不到的內容。
 *
 *  檔名統一照 `intj-eating-<品項後半>.png` 命名（跟最早那張 intj-eating-cake.png
 *  同一個規則）——美術那邊出圖時用的是另一套命名（`cookies_eat_7x1_3500x500.png`
 *  這種），進專案時已經改名成這裡的慣例，兩套名字不要同時存在，不然之後找檔案會
 *  不知道該認哪一個。 */
export const FOOD_EATING_SPRITES: Partial<Record<string, string>> = {
  "food-cookies": "/expenses/intj-eating-cookies.png",
  "food-candiedhawthorn": "/expenses/intj-eating-candiedhawthorn.png",
  "food-icecream": "/expenses/intj-eating-icecream.png",
  "food-salad": "/expenses/intj-eating-salad.png",
  "food-noodle": "/expenses/intj-eating-noodle.png",
  "food-cake": "/expenses/intj-eating-cake.png",
  "food-skewer": "/expenses/intj-eating-skewer.png",
  "food-frieddrumstick": "/expenses/intj-eating-frieddrumstick.png",
  "food-sushi": "/expenses/intj-eating-sushi.png",
  "food-shrimp": "/expenses/intj-eating-shrimp.png",
  "food-crab": "/expenses/intj-eating-crab.png",
  "food-yuzu": "/expenses/intj-eating-yuzu.png",
};

/** 食物專屬吃東西動畫的格數／循環次數，跟 SPRITE_COLS/SPRITE_ROWS 分開放，因為兩者
 *  規格真的不一樣（見 FOOD_EATING_SPRITES 的說明）。 */
export const FOOD_SPRITE_COLS = 7;
export const FOOD_SPRITE_LOOPS = 2;

/** 孵化那一段動畫：蛋裂開、角色鑽出來、最後站成 intj-model-laboratory 的待機姿勢。
 *  排法跟其他精靈圖一樣是 7 欄 × 3 列，但它是**演一次就結束**的，不像待機那樣循環。 */
export const EGG_HATCH_SPRITE = "/expenses/egg-hatch.png";

/** 動作狀態的精靈圖。排法跟其他精靈圖一樣（7 欄 × 3 列），放進 public/expenses 之後
 *  在 PET_ITEMS 加一行就會出現在商店裡。 */
export const petStateSprite = (slug: string) => `/expenses/pet-state-${slug}.png`;

/** 幾級孵化：到這一級之前角色一律是蛋，其他造型穿不上（但可以先買）。 */
export const PET_HATCH_LEVEL = 10;

export interface PetItem {
  id: string;
  name: string;
  kind: PetItemKind;
  price: number;
  /** 食物餵一次給多少經驗值。服裝沒有這個欄位。 */
  xp?: number;
  /** 服裝「吃東西」那一輪要播的精靈圖。只有蛋有自己的一張（egg-eating.png）；孵化後
   *  的造型沒有這個欄位，吃東西時維持待機姿勢（見 petOutfitSprite）——真正的「吃東西」
   *  畫面是食物本身的專屬動畫（FOOD_EATING_SPRITES），不是造型這邊的事。 */
  eating?: string;
  /** 「狀態」裡可以在背包複選、在養成頁隨機演出的那一種（例如跳舞、睡覺）。
   *  沒標的狀態（孵化）是純紀念、點了只重播一次，不能選起來。 */
  action?: boolean;
  /** 服裝要幾級才能穿。蛋沒有限制（它就是出生造型），其他造型要孵化（Lv.PET_HATCH_LEVEL）
   *  之後才穿得上——沒孵化前角色是一顆蛋，穿什麼都看不出來。
   *  可以先買起來放，只是換上去時會被擋（前後端都擋，見 pet.server.ts 的 buyWearable）。 */
  minLevel?: number;
  desc: string;
  image: string;
}

/** 商店品項。食物是消耗品（買了直接餵、換經驗值），服裝是一次性購買、可以重複換穿。 */
export const PET_ITEMS: PetItem[] = [
  // 由便宜到貴排。價格＝經驗值，一比一：買的時候花掉多少星星幣，餵下去就換回多少
  // 經驗值，不用在腦袋裡算匯率（同經驗值的自然就同價格，拉麵跟蛋糕都是 150 星星幣），
  // 不要出現「同樣經驗值但比較貴」這種永遠不該選的選項。
  //
  // 價格一律是 50 的倍數，由便宜到貴排——這個順序就是養成頁餵食列「手上一份都沒有時」
  // 的預設排序（見 pet-view.tsx），所以不要隨便插隊。
  // 食物多到一排放不下了，養成頁那排改成可以左右滑的輪播，加第十三種不用再改版面。
  { id: "food-cookies", name: "餅乾", kind: "食物", price: 50, xp: 50, desc: "配茶剛剛好", image: petItemImage("food-cookies") },
  { id: "food-candiedhawthorn", name: "糖葫蘆", kind: "食物", price: 50, xp: 50, desc: "路邊攤的小確幸", image: petItemImage("food-candiedhawthorn") },
  { id: "food-icecream", name: "冰淇淋", kind: "食物", price: 100, xp: 100, desc: "天氣熱就是要這個", image: petItemImage("food-icecream") },
  { id: "food-salad", name: "沙拉", kind: "食物", price: 100, xp: 100, desc: "偶爾也要吃點菜", image: petItemImage("food-salad") },
  { id: "food-noodle", name: "拉麵", kind: "食物", price: 150, xp: 150, desc: "吃飽一點，心情也好", image: petItemImage("food-noodle") },
  { id: "food-cake", name: "蛋糕", kind: "食物", price: 150, xp: 150, desc: "慶祝一下這個月守住預算", image: petItemImage("food-cake") },
  { id: "food-skewer", name: "串燒", kind: "食物", price: 200, xp: 200, desc: "下班後的宵夜場", image: petItemImage("food-skewer") },
  { id: "food-frieddrumstick", name: "炸雞腿", kind: "食物", price: 200, xp: 200, desc: "偶爾放縱一下", image: petItemImage("food-frieddrumstick") },
  { id: "food-sushi", name: "壽司", kind: "食物", price: 250, xp: 250, desc: "小小奢侈一下", image: petItemImage("food-sushi") },
  { id: "food-shrimp", name: "鮮蝦", kind: "食物", price: 300, xp: 300, desc: "今天想吃好一點", image: petItemImage("food-shrimp") },
  { id: "food-crab", name: "螃蟹", kind: "食物", price: 400, xp: 400, desc: "守住預算的犒賞", image: petItemImage("food-crab") },
  { id: "food-yuzu", name: "柚子酒", kind: "食物", price: 500, xp: 500, desc: "給自己的大獎勵", image: petItemImage("food-yuzu") },
  // 服裝＝一整套角色造型（換的是那張精靈圖，不是色相旋轉），所以 id 的後半要對得上
  // 檔名：outfit-plushroom → intj-model-plushroom-idle.png。目前只有待機那一組圖，
  // 孵化後的造型沒有自己的「吃東西」姿勢，吃東西時維持待機姿勢不動（見下面
  // petOutfitSprite 的說明）——不是共用一張圖，是沒有圖可以共用了。
  { id: "outfit-egg", name: "蛋", kind: "服裝", price: 0, eating: EGG_EATING_SPRITE, desc: "還沒孵化的樣子，孵化後也可以換回來", image: EGG_IDLE_SPRITE },
  { id: "outfit-laboratory", name: "書房便服", kind: "服裝", price: 0, minLevel: PET_HATCH_LEVEL, desc: "孵化後的第一套衣服", image: petModelSprite("laboratory") },
  { id: "outfit-plushroom", name: "兔兔睡衣", kind: "服裝", price: 5000, minLevel: PET_HATCH_LEVEL, desc: "抱著玩偶的居家時間", image: petModelSprite("plushroom") },
  { id: "outfit-studio", name: "畫室圍裙", kind: "服裝", price: 5000, minLevel: PET_HATCH_LEVEL, desc: "動手做點東西的日子", image: petModelSprite("studio") },
  { id: "outfit-gamingroom", name: "電玩連帽衣", kind: "服裝", price: 5000, minLevel: PET_HATCH_LEVEL, desc: "手把握著就不想放下", image: petModelSprite("gamingroom") },
  { id: "outfit-dessertcafe", name: "甜點圍裙", kind: "服裝", price: 5000, minLevel: PET_HATCH_LEVEL, desc: "今天換你站在櫃檯裡", image: petModelSprite("dessertcafe") },
  { id: "outfit-beach", name: "海灘花襯衫", kind: "服裝", price: 5000, minLevel: PET_HATCH_LEVEL, desc: "存到一筆錢的獎勵", image: petModelSprite("beach") },
  // 狀態分兩種：
  //  ・紀念（price 0、沒有 action）：不賣、不選，Lv.PET_HATCH_LEVEL 之後在背包裡解鎖，
  //    點了在預覽區重播一次。目前只有孵化。
  //  ・動作（price > 0、action: true）：在商店買、在背包複選，養成頁的角色會從勾起來的
  //    那幾個裡隨機挑一個演。圖還在畫，畫好之後在這裡加一行就會自己出現在商店跟背包
  //    （命名照 petStateSprite：pet-state-<slug>.png，一樣是 7 欄 × 3 列）。
  { id: "state-hatch", name: "孵化", kind: "狀態", price: 0, minLevel: PET_HATCH_LEVEL, desc: "破殼而出的那一刻", image: EGG_HATCH_SPRITE },
  // 背景就是商店圖本身（pet-bg-*.png，900×1600 的直式房間圖），不再用 CSS 漸層代替，
  // 所以 id 要跟檔名對得起來：bg-laboratory → pet-bg-laboratory.png。角色是去背的 PNG，
  // 直接疊在圖上就好，背景深一點也不會把角色一起乘暗。
  { id: "bg-laboratory", name: "星空書房", kind: "背景", price: 0, desc: "一開始就有的場地", image: petItemImage("bg-laboratory") },
  { id: "bg-bedroom", name: "臥室", kind: "背景", price: 5000, desc: "睡前記帳的時間", image: petItemImage("bg-bedroom") },
  { id: "bg-studio", name: "工作室", kind: "背景", price: 5000, desc: "專心做自己事情的角落", image: petItemImage("bg-studio") },
  { id: "bg-dessertcafe", name: "甜點咖啡廳", kind: "背景", price: 5000, desc: "小小奢侈的下午", image: petItemImage("bg-dessertcafe") },
  { id: "bg-gamingroom", name: "電玩房", kind: "背景", price: 5000, desc: "下班後的放鬆場地", image: petItemImage("bg-gamingroom") },
  { id: "bg-beach", name: "海邊", kind: "背景", price: 5000, desc: "存到一筆錢才去得成的旅行", image: petItemImage("bg-beach") },
];

/** 新帳號一開始身上的造型＝蛋。孵化（Lv.PET_HATCH_LEVEL）那一次會自動換成
 *  DEFAULT_HATCHED_OUTFIT_ID，之後想換回蛋可以自己在背包切（見 pet.server.ts）。 */
export const EGG_OUTFIT_ID = "outfit-egg";
export const DEFAULT_OUTFIT_ID = EGG_OUTFIT_ID;
export const DEFAULT_HATCHED_OUTFIT_ID = "outfit-laboratory";
export const DEFAULT_BACKGROUND_ID = "bg-laboratory";

/** 沒有設定、或指到不存在的背景（例如資料庫裡還存著舊的 bg-default）時退回預設場地，
 *  畫面不會變成一塊空白。 */
export const FALLBACK_BACKGROUND_IMAGE = petItemImage(DEFAULT_BACKGROUND_ID);

export function petItemById(id: string): PetItem | undefined {
  return PET_ITEMS.find((i) => i.id === id);
}

/** 服裝精靈圖的排法：7 欄 × 3 列、一格 500×500（整張 3500×1500），從左上往右接成一輪
 *  連續動畫。pet-sprite.tsx 播動畫、這裡裁第一格當縮圖，兩邊用的是同一組數字。 */
export const SPRITE_COLS = 7;
export const SPRITE_ROWS = 3;

/** 沒有設定、或指到不存在的服裝時退回蛋（例如資料庫裡還存著改版前的 outfit-mint）——
 *  蛋是每個人都有的出生造型，退到它一定不會變成「穿著一件不該有的衣服」。 */
export const FALLBACK_MODEL_SPRITE = EGG_IDLE_SPRITE;

/** 角色身上那套造型的精靈圖。孵化那一段不看造型——它本來就是「從蛋變成角色」的過程，
 *  一律播 EGG_HATCH_SPRITE。
 *
 *  **吃東西沒有圖可以播時退回待機姿勢，不是退回一張共用圖**：孵化後的造型本來會共用
 *  一張 intj-eating.png，那張圖已經淘汰、不再放進 public/expenses。現在吃東西時：
 *  有專屬動畫的食物由 PetSprite 自己接管（見 FOOD_EATING_SPRITES），這裡只負責「這份
 *  食物還沒畫專屬動畫」的情況——維持角色待機的那張圖不動，看起來像站著吃，比播一張
 *  不存在的圖（404）或借用別的造型的吃相要安全。 */
export function petOutfitSprite(id: string, mood: "idle" | "eating" | "hatching" = "idle"): string {
  if (mood === "hatching") return EGG_HATCH_SPRITE;
  const item = petItemById(id);
  if (item?.kind !== "服裝") return FALLBACK_MODEL_SPRITE;
  return mood === "eating" ? (item.eating ?? item.image) : item.image;
}

/** 商店賣的狀態（動作狀態）。孵化那種紀念狀態不賣，所以不在這裡。 */
export const PET_ACTION_STATES = () => PET_ITEMS.filter((i) => i.kind === "狀態" && i.action);

/** 這個品項這個等級解鎖了嗎（服裝能不能穿、狀態能不能看）。 */
export function outfitUnlocked(item: PetItem, level: number): boolean {
  return level >= (item.minLevel ?? 1);
}

/** 畫面上實際要畫的造型——還沒到孵化等級一律畫蛋，不管資料裡存的是哪一套。
 *
 *  資料可能不同步：舊帳號存的是改版前的 outfit-laboratory 但才 Lv.3，或是先買了衣服
 *  卻還沒孵化。畫面一律以等級為準，不然會看到一隻「還沒孵化但已經穿好衣服」的角色。 */
export function effectiveOutfitId(id: string, level: number): string {
  const item = petItemById(id);
  if (item?.kind !== "服裝" || !outfitUnlocked(item, level)) return EGG_OUTFIT_ID;
  return item.id;
}

/** 角色場地（跟商店／背包裡的背景縮圖）要用的 CSS background 值。
 *
 *  圖是 9:16 的直式圖、場地跟縮圖都比它矮，所以用 cover 裁切——contain 會在兩側留白，
 *  房間圖看起來就像一張貼紙而不是場景。
 *
 *  position 決定裁到圖的哪一段：預設 center（養成頁的場地本來就是 9:16，幾乎沒裁到）。
 *  框愈扁、能看到的那條愈窄，置中會切在房間中間偏下的地板上，這時候呼叫端自己往上挪
 *  一點（例如背包預覽的 "center 42%"）才看得到角色站的位置跟後面的場景。 */
export function petBackground(id: string, position = "center"): string {
  const item = petItemById(id);
  const src = item?.kind === "背景" ? item.image : FALLBACK_BACKGROUND_IMAGE;
  return `url("${src}") ${position} / cover no-repeat`;
}

/** 商店／背包格子裡的縮圖要用的 CSS background 值；食物回 null——食物有自己的去背小圖，
 *  照常交給 IconImg 畫就好。
 *
 *  背景跟服裝都不能走 IconImg：背景是 9:16 的大圖（contain 會兩側留白），服裝則是一張
 *  21 格的精靈圖（整張縮進格子裡會變成 21 個小人）。這裡用 background 的簡寫一次指定
 *  位置與大小——服裝放大成 700% × 300% 再對齊左上角，看到的就只有第一格。 */
export function petItemThumb(item: PetItem): string | null {
  if (item.kind === "背景") return petBackground(item.id);
  if (item.kind === "服裝") return spriteFrame(item.image, 0, 0);
  // 孵化取第 2 列第 4 格（正在破殼那一格）——它的第一格跟最後一格分別只是一顆蛋跟站好的
  // 角色，跟服裝格子裡的圖長得一樣。動作狀態就取第一格（動作從那一格開始）。
  if (item.kind === "狀態") return item.action ? spriteFrame(item.image, 0, 0) : spriteFrame(item.image, 3, 1);
  return null;
}

/** 從 7 欄 × 3 列的精靈圖裡裁出第 col 欄、第 row 列那一格的 CSS background。 */
function spriteFrame(src: string, col: number, row: number): string {
  const x = (col / (SPRITE_COLS - 1)) * 100;
  const y = (row / (SPRITE_ROWS - 1)) * 100;
  return `url("${src}") ${x}% ${y}% / ${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}% no-repeat`;
}

// ── 等級 ─────────────────────────────────────────────────────────────────────
// 每一級需要的經驗值遞增（第 n 級要 n*100），避免等級一下子衝很高之後就再也不會動。

/** 從第 level 級升到下一級需要多少經驗值。 */
export function xpForNextLevel(level: number): number {
  return level * 100;
}

export interface PetLevel {
  level: number;
  /** 目前這一級已經累積的經驗值。 */
  xpInLevel: number;
  /** 升到下一級還需要多少。 */
  xpNeeded: number;
  pct: number;
}

/** 把累積總經驗值換算成等級跟這一級的進度。 */
export function levelFromXp(totalXp: number): PetLevel {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  const xpNeeded = xpForNextLevel(level);
  return { level, xpInLevel: remaining, xpNeeded, pct: Math.round((remaining / xpNeeded) * 100) };
}

// ── 理財段位（看淨資產，純展示）──────────────────────────────────────────────

export interface WealthTier {
  name: string;
  /** 達到這個段位需要的淨資產。 */
  min: number;
}

export const WEALTH_TIERS: WealthTier[] = [
  { name: "剛起步", min: 0 },
  { name: "小有積蓄", min: 50_000 },
  { name: "穩健存款", min: 200_000 },
  { name: "理財有成", min: 500_000 },
  { name: "財務自由路上", min: 1_000_000 },
];

export function wealthTier(netWorth: number): WealthTier {
  let tier = WEALTH_TIERS[0];
  for (const t of WEALTH_TIERS) if (netWorth >= t.min) tier = t;
  return tier;
}

// ── 獎勵規則 ─────────────────────────────────────────────────────────────────
// 每一種獎勵都有一個唯一的 key（例如 "daily:2026-10-21"），發過的 key 記在 pet 文件裡，
// 所以不管結算跑幾次都只會發一次——結算是掛在「每次進記帳本」上的，一定會重複執行。

export interface PetReward {
  key: string;
  coins: number;
  label: string;
}

/** 簽到的基本單位：第一天 +100，第二天再多 +200，第三天再多 +300…… */
export const SIGNIN_STEP_COINS = 100;
/** 連續簽到最多累加到第幾天——第八天之後一律照第七天的金額給，不會無限長大。 */
export const SIGNIN_STREAK_CAP = 7;
/** 每記一筆帳給多少。 */
export const ENTRY_COINS = 100;
export const BUDGET_KEPT_COINS = 50;

/** 連續簽到第 n 天當天拿多少：1→100、2→300、3→600……7→2800，第八天之後維持 2800。
 *
 *  是「累加」不是「等差」：第二天拿的是 100＋200，不是只有 200。連到第七天那天一次
 *  拿 2800，跟第一天的 100 差 28 倍——斷掉要重頭爬的成本夠高，才有「不想斷」的動力，
 *  這也是整個簽到機制唯一真正有效的地方。
 *
 *  第八天之後不再往上加：再累下去會變成只要連著開 App 就能無限賺，星星幣跟記帳習慣
 *  就脫鉤了。 */
export function signinCoins(streakDay: number): number {
  const n = Math.min(Math.max(streakDay, 1), SIGNIN_STREAK_CAP);
  return (SIGNIN_STEP_COINS * n * (n + 1)) / 2;
}

/** 連續天數最多往回數到這裡為止——避免資料很長時白跑一大圈，一年份的連續紀錄已經
 *  遠超過所有里程碑了。 */
const MAX_STREAK_LOOKBACK = 400;

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 簽到紀錄的 key——已領過的簽到就是靠這些 key 認出來的，連續天數也是從它們往回數，
 *  不用另外存一份「最後簽到日」欄位（兩份資料一定會有對不上的那天）。 */
export const signinKey = (date: string) => `signin:${date}`;

/** 今天是連續簽到的第幾天（含今天）。往回數已經領過簽到獎勵的日子，一斷就停。
 *
 *  今天還沒領的情況下回傳 1 ＝ 新的一段從今天開始；今天已經領過的話回傳的就是今天那一
 *  段的長度（畫面上顯示「已連續 N 天」用）。 */
export function signinStreakDay(claimedKeys: Set<string>, today: string): number {
  let days = claimedKeys.has(signinKey(today)) ? 0 : 1;
  const cursor = new Date(`${today}T00:00:00`);
  if (claimedKeys.has(signinKey(today))) cursor.setDate(cursor.getDate() + 1); // 從今天開始往回數
  for (let i = 0; i < MAX_STREAK_LOOKBACK; i++) {
    cursor.setDate(cursor.getDate() - 1);
    if (!claimedKeys.has(signinKey(toISO(cursor)))) break;
    days += 1;
  }
  return Math.max(days, 1);
}

/**
 * 算出「這次結算應該發哪些還沒發過的獎勵」。
 *
 * 這裡只處理「打開記帳本就該自動結算」的那一種：上個月每個有編預算的分類都沒超支
 * （每個月一次）。另外兩種各有自己的路——「每記一筆」要數筆數不是日期，用計數器處理
 * （見 pet.server.ts 的 settlePetRewards）；「每日簽到」要使用者自己按按鈕
 * （見 pet.server.ts 的 signInToday）。
 *
 * budgetKeptMonth 傳 null 代表「上個月沒有編任何預算」或「有超支」，就不發這筆。
 */
export function pendingRewards({
  budgetKeptMonth,
  claimedKeys,
}: {
  budgetKeptMonth: string | null;
  claimedKeys: Set<string>;
}): PetReward[] {
  const rewards: PetReward[] = [];

  // 簽到不在這裡發：它改成要自己按「今日簽到」那顆按鈕（見 pet.server.ts 的 signInToday）。
  // 本來是「打開記帳本就自動算你簽到」，但那樣簽到彈窗裡那顆按鈕永遠是已簽到的狀態，
  // 使用者沒有「今天我來簽個到」這個動作可做，連續天數也只是被動長出來的數字。

  if (budgetKeptMonth) {
    rewards.push({ key: `budget:${budgetKeptMonth}`, coins: BUDGET_KEPT_COINS, label: `${budgetKeptMonth} 沒有超支` });
  }

  return rewards.filter((r) => !claimedKeys.has(r.key));
}
