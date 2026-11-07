// 純邏輯、不碰資料庫——CRUD 跟獎勵結算在同資料夾的 pet.server.ts（見 categories.ts 開頭）。
//
// ── 養成功能的設計原則 ────────────────────────────────────────────────────────
// 貨幣（星星幣）只從「好的記帳行為」來，不從淨資產或消費金額來。理由是：淨資產會因為
// 一筆大額醫療費、年繳保費而掉下去，如果角色跟著變虛弱，等於在懲罰誠實記帳，甚至會
// 讓人乾脆不記那筆大支出——那跟記帳工具的目的正好相反。所以：
//   星星幣 ← 每天有記帳、連續記帳、上個月守住預算（這些都是使用者能主動控制的行為）
//   淨資產 → 只拿來算「理財段位」，純展示、不能換東西
// 這樣淨資產還是有參與感，但不會變成懲罰。

export type PetItemKind = "食物" | "服裝" | "背景";

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

/** 孵化後的造型共用的「吃東西」圖——還沒有各造型自己的那一張。 */
const HATCHED_EATING_SPRITE = "/expenses/intj-eating.png";

/** 幾級孵化：到這一級之前角色一律是蛋，其他造型穿不上（但可以先買）。 */
export const PET_HATCH_LEVEL = 10;

export interface PetItem {
  id: string;
  name: string;
  kind: PetItemKind;
  price: number;
  /** 食物餵一次給多少經驗值。服裝沒有這個欄位。 */
  xp?: number;
  /** 服裝「吃東西」那一輪要播的精靈圖。蛋有自己的一張，孵化後的造型目前共用
   *  intj-eating.png（還沒有各造型的吃東西圖）。 */
  eating?: string;
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
  // 經驗值，不用在腦袋裡算匯率。（同經驗值的自然就同價格，蛋糕跟串燒都是 80
  // 星星幣），不要出現「同樣經驗值但比較貴」這種永遠不該選的選項。
  //
  // 固定四種：養成頁的餵食鍵是疊在場地上的一排按鈕框（見 pet-view.tsx），一排剛好四格，
  // 要加第五種食物就得先決定那排怎麼排。
  { id: "food-noodle", name: "拉麵", kind: "食物", price: 30, xp: 30, desc: "吃飽一點，心情也好", image: petItemImage("food-noodle") },
  { id: "food-cake", name: "蛋糕", kind: "食物", price: 80, xp: 80, desc: "慶祝一下這個月守住預算", image: petItemImage("food-cake") },
  { id: "food-skewer", name: "串燒", kind: "食物", price: 80, xp: 80, desc: "下班後的宵夜場", image: petItemImage("food-skewer") },
  { id: "food-yuzu", name: "柚子酒", kind: "食物", price: 100, xp: 100, desc: "給自己的大獎勵", image: petItemImage("food-yuzu") },
  // 服裝＝一整套角色造型（換的是那張精靈圖，不是色相旋轉），所以 id 的後半要對得上
  // 檔名：outfit-plushroom → intj-model-plushroom-idle.png。目前只有待機那一組圖，
  // 吃東西還是共用 intj-eating.png（見 pet-sprite.tsx）。
  { id: "outfit-egg", name: "蛋", kind: "服裝", price: 0, eating: EGG_EATING_SPRITE, desc: "還沒孵化的樣子，孵化後也可以換回來", image: EGG_IDLE_SPRITE },
  { id: "outfit-laboratory", name: "書房便服", kind: "服裝", price: 0, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "孵化後的第一套衣服", image: petModelSprite("laboratory") },
  { id: "outfit-plushroom", name: "兔兔睡衣", kind: "服裝", price: 80, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "抱著玩偶的居家時間", image: petModelSprite("plushroom") },
  { id: "outfit-studio", name: "畫室圍裙", kind: "服裝", price: 120, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "動手做點東西的日子", image: petModelSprite("studio") },
  { id: "outfit-gamingroom", name: "電玩連帽衣", kind: "服裝", price: 140, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "手把握著就不想放下", image: petModelSprite("gamingroom") },
  { id: "outfit-dessertcafe", name: "甜點圍裙", kind: "服裝", price: 160, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "今天換你站在櫃檯裡", image: petModelSprite("dessertcafe") },
  { id: "outfit-beach", name: "海灘花襯衫", kind: "服裝", price: 200, eating: HATCHED_EATING_SPRITE, minLevel: PET_HATCH_LEVEL, desc: "存到一筆錢的獎勵", image: petModelSprite("beach") },
  // 背景就是商店圖本身（pet-bg-*.png，900×1600 的直式房間圖），不再用 CSS 漸層代替，
  // 所以 id 要跟檔名對得起來：bg-laboratory → pet-bg-laboratory.png。角色是去背的 PNG，
  // 直接疊在圖上就好，背景深一點也不會把角色一起乘暗。
  { id: "bg-laboratory", name: "星空書房", kind: "背景", price: 0, desc: "一開始就有的場地", image: petItemImage("bg-laboratory") },
  { id: "bg-bedroom", name: "臥室", kind: "背景", price: 100, desc: "睡前記帳的時間", image: petItemImage("bg-bedroom") },
  { id: "bg-studio", name: "工作室", kind: "背景", price: 150, desc: "專心做自己事情的角落", image: petItemImage("bg-studio") },
  { id: "bg-dessertcafe", name: "甜點咖啡廳", kind: "背景", price: 200, desc: "小小奢侈的下午", image: petItemImage("bg-dessertcafe") },
  { id: "bg-gamingroom", name: "電玩房", kind: "背景", price: 250, desc: "下班後的放鬆場地", image: petItemImage("bg-gamingroom") },
  { id: "bg-beach", name: "海邊", kind: "背景", price: 300, desc: "存到一筆錢才去得成的旅行", image: petItemImage("bg-beach") },
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

/** 角色身上那套造型的精靈圖（待機／吃東西各一張）。 */
export function petOutfitSprite(id: string, mood: "idle" | "eating" = "idle"): string {
  const item = petItemById(id);
  if (item?.kind !== "服裝") return mood === "eating" ? HATCHED_EATING_SPRITE : FALLBACK_MODEL_SPRITE;
  return mood === "eating" ? (item.eating ?? HATCHED_EATING_SPRITE) : item.image;
}

/** 這套造型這個等級穿得上嗎。 */
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
 *  圖是 9:16 的直式圖、場地跟縮圖都比它矮，所以用 cover 置中裁切——contain 會在兩側
 *  留白，房間圖看起來就像一張貼紙而不是場景。 */
export function petBackground(id: string): string {
  const item = petItemById(id);
  const src = item?.kind === "背景" ? item.image : FALLBACK_BACKGROUND_IMAGE;
  return `url("${src}") center / cover no-repeat`;
}

/** 商店／背包格子裡的縮圖要用的 CSS background 值；食物回 null——食物有自己的去背小圖，
 *  照常交給 IconImg 畫就好。
 *
 *  背景跟服裝都不能走 IconImg：背景是 9:16 的大圖（contain 會兩側留白），服裝則是一張
 *  21 格的精靈圖（整張縮進格子裡會變成 21 個小人）。這裡用 background 的簡寫一次指定
 *  位置與大小——服裝放大成 700% × 300% 再對齊左上角，看到的就只有第一格。 */
export function petItemThumb(item: PetItem): string | null {
  if (item.kind === "背景") return petBackground(item.id);
  if (item.kind === "服裝") return `url("${item.image}") 0% 0% / ${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}% no-repeat`;
  return null;
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
 * 兩種來源（第三種「每記一筆」不走這裡——它要數的是筆數不是日期，用計數器處理，
 * 見 pet.server.ts 的 settlePetRewards）：
 *  - 每日簽到：每天打開記帳本就算簽到，連續天數愈長那天拿得愈多（見 signinCoins）
 *  - 上個月每個有編預算的分類都沒超支（每個月一次）
 *
 * budgetKeptMonth 傳 null 代表「上個月沒有編任何預算」或「有超支」，就不發這筆。
 */
export function pendingRewards({
  today,
  budgetKeptMonth,
  claimedKeys,
}: {
  today: string;
  budgetKeptMonth: string | null;
  claimedKeys: Set<string>;
}): PetReward[] {
  const rewards: PetReward[] = [];

  const streakDay = signinStreakDay(claimedKeys, today);
  rewards.push({
    key: signinKey(today),
    coins: signinCoins(streakDay),
    label: streakDay > 1 ? `連續簽到第 ${streakDay} 天` : "今日簽到",
  });

  if (budgetKeptMonth) {
    rewards.push({ key: `budget:${budgetKeptMonth}`, coins: BUDGET_KEPT_COINS, label: `${budgetKeptMonth} 沒有超支` });
  }

  return rewards.filter((r) => !claimedKeys.has(r.key));
}
