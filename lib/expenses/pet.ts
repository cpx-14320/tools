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
 *  id 本身已經是英文 slug（food-sushi、outfit-mint…），直接接在 `pet-` 後面就好：
 *  `pet-food-sushi.png`、`pet-outfit-mint.png`。原本多夾一段 `item`（pet-item-food-sushi）
 *  是贅字，檔名長又難掃。圖檔還沒放進 public/expenses 之前 IconImg 會用漸層佔位，
 *  404 不會破版。 */
export const petItemImage = (id: string) => `/expenses/pet-${id}.png`;

export interface PetItem {
  id: string;
  name: string;
  kind: PetItemKind;
  price: number;
  /** 食物餵一次給多少經驗值。服裝沒有這個欄位。 */
  xp?: number;
  /** 服裝目前用色相旋轉模擬換裝（還沒有各套服裝的圖），單位是度。 */
  hueRotate?: number;
  /** 背景目前用 CSS 漸層模擬（還沒有背景圖），直接套在角色場地那塊上。
   *
   *  一定要是淺色：角色圖是白底、不是去背的 PNG，場地上是靠 mix-blend-mode: multiply
   *  把白色融掉的（見 components/expenses/pet-sprite.tsx），底色一深，角色自己也會跟著
   *  被乘暗。等換成去背的圖才能放深色背景。 */
  background?: string;
  desc: string;
  image: string;
}

/** 商店品項。食物是消耗品（買了直接餵、換經驗值），服裝是一次性購買、可以重複換穿。 */
export const PET_ITEMS: PetItem[] = [
  // 由便宜到貴排。價格＝經驗值，一比一：買的時候花掉多少星星幣，餵下去就換回多少
  // 經驗值，不用在腦袋裡算匯率。（同經驗值的自然就同價格，蛋糕跟串燒都是 80
  // 星星幣），不要出現「同樣經驗值但比較貴」這種永遠不該選的選項。
  { id: "food-noodle", name: "拉麵", kind: "食物", price: 30, xp: 30, desc: "吃飽一點，心情也好", image: petItemImage("food-noodle") },
  { id: "food-sushi", name: "壽司", kind: "食物", price: 50, xp: 50, desc: "小小奢侈一下", image: petItemImage("food-sushi") },
  { id: "food-cake", name: "蛋糕", kind: "食物", price: 80, xp: 80, desc: "慶祝一下這個月守住預算", image: petItemImage("food-cake") },
  { id: "food-skewer", name: "串燒", kind: "食物", price: 80, xp: 80, desc: "下班後的宵夜場", image: petItemImage("food-skewer") },
  { id: "food-yuzu", name: "柚子酒", kind: "食物", price: 100, xp: 100, desc: "給自己的大獎勵", image: petItemImage("food-yuzu") },
  { id: "outfit-default", name: "原色套裝", kind: "服裝", price: 0, hueRotate: 0, desc: "一開始就有的衣服", image: petItemImage("outfit-default") },
  { id: "outfit-mint", name: "薄荷綠", kind: "服裝", price: 80, hueRotate: 120, desc: "清爽的配色", image: petItemImage("outfit-mint") },
  { id: "outfit-ocean", name: "海洋藍", kind: "服裝", price: 120, hueRotate: 200, desc: "沉穩的深藍", image: petItemImage("outfit-ocean") },
  { id: "outfit-sunset", name: "夕陽橘", kind: "服裝", price: 160, hueRotate: 300, desc: "暖色系，存到一筆錢的獎勵", image: petItemImage("outfit-sunset") },
  {
    id: "bg-default",
    name: "淡紫日常",
    kind: "背景",
    price: 0,
    background: "linear-gradient(to bottom, #F3EFFC, #FDF5F8)",
    desc: "一開始就有的場地",
    image: petItemImage("bg-default"),
  },
  {
    id: "bg-garden",
    name: "草地庭院",
    kind: "背景",
    price: 100,
    background: "linear-gradient(to bottom, #E6F5E9, #F7FBF0)",
    desc: "出門曬太陽的好天氣",
    image: petItemImage("bg-garden"),
  },
  {
    id: "bg-sunset",
    name: "黃昏河堤",
    kind: "背景",
    price: 150,
    background: "linear-gradient(to bottom, #FFE8D8, #FFF5EC)",
    desc: "下班後散步的那段路",
    image: petItemImage("bg-sunset"),
  },
  {
    id: "bg-night",
    name: "夜空微光",
    kind: "背景",
    price: 200,
    background: "linear-gradient(to bottom, #DEE4FA, #F0F2FD)",
    desc: "睡前記帳的時間",
    image: petItemImage("bg-night"),
  },
];

export const DEFAULT_OUTFIT_ID = "outfit-default";
export const DEFAULT_BACKGROUND_ID = "bg-default";

/** 沒有設定、或指到不存在的背景時退回預設場地的漸層，畫面不會變成一塊空白。 */
export const FALLBACK_BACKGROUND = "linear-gradient(to bottom, #F3EFFC, #FDF5F8)";

export function petItemById(id: string): PetItem | undefined {
  return PET_ITEMS.find((i) => i.id === id);
}

/** 角色場地要用的 CSS background 值。 */
export function petBackground(id: string): string {
  return petItemById(id)?.background ?? FALLBACK_BACKGROUND;
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
