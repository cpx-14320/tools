// 純邏輯、不碰資料庫——CRUD 跟獎勵結算在同資料夾的 pet.server.ts（見 categories.ts 開頭）。
//
// ── 養成功能的設計原則 ────────────────────────────────────────────────────────
// 貨幣（星星幣）只從「好的記帳行為」來，不從淨資產或消費金額來。理由是：淨資產會因為
// 一筆大額醫療費、年繳保費而掉下去，如果角色跟著變虛弱，等於在懲罰誠實記帳，甚至會
// 讓人乾脆不記那筆大支出——那跟記帳工具的目的正好相反。所以：
//   星星幣 ← 每天有記帳、連續記帳、上個月守住預算（這些都是使用者能主動控制的行為）
//   淨資產 → 只拿來算「理財段位」，純展示、不能換東西
// 這樣淨資產還是有參與感，但不會變成懲罰。

export type PetItemKind = "食物" | "服裝";

export interface PetItem {
  id: string;
  name: string;
  kind: PetItemKind;
  price: number;
  /** 食物餵一次給多少經驗值。服裝沒有這個欄位。 */
  xp?: number;
  /** 服裝目前用色相旋轉模擬換裝（還沒有各套服裝的圖），單位是度。 */
  hueRotate?: number;
  desc: string;
}

/** 商店品項。食物是消耗品（買了直接餵、換經驗值），服裝是一次性購買、可以重複換穿。 */
export const PET_ITEMS: PetItem[] = [
  { id: "food-rice", name: "飯糰", kind: "食物", price: 10, xp: 10, desc: "最基本的一餐" },
  { id: "food-noodle", name: "拉麵", kind: "食物", price: 25, xp: 30, desc: "吃飽一點，心情也好" },
  { id: "food-cake", name: "蛋糕", kind: "食物", price: 60, xp: 80, desc: "慶祝一下這個月守住預算" },
  { id: "outfit-default", name: "原色套裝", kind: "服裝", price: 0, hueRotate: 0, desc: "一開始就有的衣服" },
  { id: "outfit-mint", name: "薄荷綠", kind: "服裝", price: 80, hueRotate: 120, desc: "清爽的配色" },
  { id: "outfit-ocean", name: "海洋藍", kind: "服裝", price: 120, hueRotate: 200, desc: "沉穩的深藍" },
  { id: "outfit-sunset", name: "夕陽橘", kind: "服裝", price: 160, hueRotate: 300, desc: "暖色系，存到一筆錢的獎勵" },
];

export const DEFAULT_OUTFIT_ID = "outfit-default";

export function petItemById(id: string): PetItem | undefined {
  return PET_ITEMS.find((i) => i.id === id);
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

/** 連續記帳的里程碑：到第 N 天給一次，不是每天都給。 */
const STREAK_MILESTONES: { days: number; coins: number }[] = [
  { days: 3, coins: 10 },
  { days: 7, coins: 25 },
  { days: 14, coins: 50 },
  { days: 30, coins: 100 },
];

export const DAILY_LOG_COINS = 5;
export const BUDGET_KEPT_COINS = 50;

/** 連續天數最多往回數到這裡為止——避免資料很長時白跑一大圈，一年份的連續紀錄已經
 *  遠超過所有里程碑了。 */
const MAX_STREAK_LOOKBACK = 400;

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 從「有記帳的日期清單」算出到 today 為止連續記了幾天（含今天；今天沒記就是 0），
 *  以及這一段連續紀錄是從哪一天開始的——開始日拿來當里程碑獎勵的 key，所以「中斷之後
 *  重新連起來」會被當成新的一段、可以再拿一次獎勵，而不是一輩子只能領一次。 */
export function loggingStreak(datesWithEntries: Set<string>, today: string): { days: number; startDate: string } {
  if (!datesWithEntries.has(today)) return { days: 0, startDate: today };
  let days = 0;
  let startDate = today;
  const cursor = new Date(`${today}T00:00:00`);
  while (days < MAX_STREAK_LOOKBACK) {
    const iso = toISO(cursor);
    if (!datesWithEntries.has(iso)) break;
    days += 1;
    startDate = iso;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { days, startDate };
}

/**
 * 算出「這次結算應該發哪些還沒發過的獎勵」。
 *
 * 三種來源：
 *  - 當天有記帳（每天一次）
 *  - 連續記帳里程碑（3/7/14/30 天各一次）
 *  - 上個月每個有編預算的分類都沒超支（每個月一次）
 *
 * budgetKeptMonth 傳 null 代表「上個月沒有編任何預算」或「有超支」，就不發這筆。
 */
export function pendingRewards({
  datesWithEntries,
  today,
  budgetKeptMonth,
  claimedKeys,
}: {
  datesWithEntries: Set<string>;
  today: string;
  budgetKeptMonth: string | null;
  claimedKeys: Set<string>;
}): PetReward[] {
  const rewards: PetReward[] = [];

  if (datesWithEntries.has(today)) {
    rewards.push({ key: `daily:${today}`, coins: DAILY_LOG_COINS, label: "今天有記帳" });
  }

  // key 綁「這一段連續紀錄的起始日」而不是今天，不然只要連續超過 3 天，之後每天都會
  // 再發一次 3 天里程碑的獎勵。
  const streak = loggingStreak(datesWithEntries, today);
  for (const m of STREAK_MILESTONES) {
    if (streak.days >= m.days) {
      rewards.push({ key: `streak:${m.days}:${streak.startDate}`, coins: m.coins, label: `連續記帳 ${m.days} 天` });
    }
  }

  if (budgetKeptMonth) {
    rewards.push({ key: `budget:${budgetKeptMonth}`, coins: BUDGET_KEPT_COINS, label: `${budgetKeptMonth} 沒有超支` });
  }

  return rewards.filter((r) => !claimedKeys.has(r.key));
}
