/** 養成資料與任務純函式。價格與養成分離，獎勵不依購買金額或價格漲跌核發。 */
export const COMPANIONS = [
  { id: "cabbage", name: "高麗菜糰糰", nickname: "糰糰", threshold: 0, story: "把小小的行情看懂，每天都多一點買菜的把握。", code: "FA1" },
  { id: "radish", name: "蘿蔔蹦蹦", nickname: "蹦蹦", threshold: 2, story: "一台斤是 0.6 公斤。份量寫清楚，整籃的價格就更有底。", code: "FB2" },
  { id: "strawberry", name: "草莓啾啾", nickname: "啾啾", threshold: 5, story: "季節慢慢走，每一種當季食材都有自己的故事。", code: "GC3" },
  { id: "pumpkin", name: "南瓜慢慢", nickname: "慢慢", threshold: 8, story: "探索不用急，偶爾回來看看，也能慢慢長大。", code: "FF1" },
  { id: "eggplant", name: "茄子波波", nickname: "波波", threshold: 12, story: "同樣的食材，在不同場所的價格也會不一樣。", code: "FC9" },
  { id: "corn", name: "玉米暖暖", nickname: "暖暖", threshold: 16, story: "把常買的份量放進菜籃，讓下一次出門更輕鬆。", code: "FD5" },
] as const;
export type CompanionId = typeof COMPANIONS[number]["id"];
export type QuestId = "explore" | "chart" | "basket";
export const QUESTS = [
  { id: "explore", title: "和夥伴逛逛行情", description: "看看 3 種不同食材的價格", target: 3, reward: 5, href: "/tools/freshwise/browse", icon: "market" },
  { id: "chart", title: "學會看價格走勢", description: "在有走勢的詳情頁切換一次期間", target: 1, reward: 3, href: "/tools/freshwise/browse", icon: "chart" },
  { id: "basket", title: "整理自己的採買份量", description: "幫菜籃中還沒填份量的項目填好份量", target: 1, reward: 3, href: "/tools/freshwise/basket", icon: "basket" },
] as const;
export interface CompanionState {
  version: 1;
  day: string;
  dew: number;
  xp: number;
  growth: Record<CompanionId, number>;
  stamps: number;
  active: CompanionId;
  visited: string[];
  chart: boolean;
  basket: boolean;
  played: boolean;
  claimed: QuestId[];
}
export type CompanionEvent = { type: "view"; code: string } | { type: "chart" } | { type: "basket" };
export const COMPANION_STORAGE_KEY = "freshwise.companions.v1";
export function companionDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function initialCompanionState(day: string): CompanionState {
  return { version: 1, day, dew: 6, xp: 0, growth: { cabbage: 0, radish: 0, strawberry: 0, pumpkin: 0, eggplant: 0, corn: 0 }, stamps: 0, active: "cabbage", visited: [], chart: false, basket: false, played: false, claimed: [] };
}
export function dailyState(state: CompanionState, day: string): CompanionState {
  return state.day === day ? state : { ...state, day, visited: [], chart: false, basket: false, played: false, claimed: [] };
}
function safeCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000) : fallback;
}
/** 僅載入已知欄位，舊資料或損壞儲存不會讓查價頁面無法使用。 */
export function parseCompanionState(raw: string | null, day: string): CompanionState {
  const fallback = initialCompanionState(day);
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1) return fallback;
    const s = data as Record<string, unknown>;
    const stamps = safeCount(s.stamps, 0);
    const active = COMPANIONS.find((pet) => pet.id === s.active && pet.threshold <= stamps)?.id ?? "cabbage";
    const storedGrowth = s.growth && typeof s.growth === "object" ? s.growth as Record<string, unknown> : {};
    const growth = Object.fromEntries(COMPANIONS.map((pet) => [pet.id, safeCount(storedGrowth[pet.id], pet.id === active ? safeCount(s.xp, 0) : 0)])) as Record<CompanionId, number>;
    return dailyState({ ...fallback, day: typeof s.day === "string" ? s.day : day,
      dew: safeCount(s.dew, 6), xp: growth[active], growth, stamps, active,
      visited: Array.isArray(s.visited) ? [...new Set(s.visited.filter((x): x is string => typeof x === "string" && /^[A-Z0-9]{2,12}$/.test(x)))].slice(0, 3) : [],
      claimed: Array.isArray(s.claimed) ? QUESTS.filter((q) => s.claimed instanceof Array && s.claimed.includes(q.id)).map((q) => q.id) : [],
      chart: s.chart === true, basket: s.basket === true, played: s.played === true,
    }, day);
  } catch { return fallback; }
}
/** 升一級要多少成長值。等級、進度條、稱呼全部從這裡算，不要在畫面各自寫一次
 *  `1 + Math.floor(xp / 40)`——以前首頁與夥伴頁各算一次、稱呼還長得不一樣
 *  （首頁「Lv.1 蹦蹦」、夥伴頁「Lv.1 · 萌芽夥伴」），同一隻夥伴在兩頁看起來像兩回事。 */
export const XP_PER_LEVEL = 40;

export interface CompanionLevel {
  level: number;
  /** 這一級已經累積的成長值（0 ～ XP_PER_LEVEL）。 */
  progress: number;
  max: number;
  /** 畫面上的稱呼，兩頁共用：`Lv.1 蹦蹦`。 */
  label: string;
  pet: (typeof COMPANIONS)[number];
}

export function companionLevel(state: CompanionState): CompanionLevel {
  const pet = COMPANIONS.find((p) => p.id === state.active) ?? COMPANIONS[0];
  return {
    level: 1 + Math.floor(state.xp / XP_PER_LEVEL),
    progress: state.xp % XP_PER_LEVEL,
    max: XP_PER_LEVEL,
    label: `Lv.${1 + Math.floor(state.xp / XP_PER_LEVEL)} ${pet.nickname}`,
    pet,
  };
}

export function recordCompanionEvent(state: CompanionState, event: CompanionEvent, day: string): CompanionState {
  const current = dailyState(state, day);
  if (event.type === "view") {
    if (!/^[A-Z0-9]{2,12}$/.test(event.code) || current.visited.includes(event.code) || current.visited.length >= 3) return current;
    return { ...current, visited: [...current.visited, event.code] };
  }
  return current[event.type] ? current : { ...current, [event.type]: true };
}
export function questProgress(state: CompanionState, quest: QuestId): number {
  return quest === "explore" ? state.visited.length : Number(state[quest]);
}
export function claimCompanionQuest(state: CompanionState, id: QuestId, day: string): CompanionState {
  const current = dailyState(state, day);
  const quest = QUESTS.find((q) => q.id === id);
  if (!quest || current.claimed.includes(id) || questProgress(current, id) < quest.target) return current;
  return { ...current, claimed: [...current.claimed, id], dew: current.dew + quest.reward, stamps: current.stamps + 1 };
}
export function careForCompanion(state: CompanionState, action: "water" | "play", day: string): CompanionState {
  const current = dailyState(state, day);
  if (action === "water") return current.dew < 3 ? current : { ...current, dew: current.dew - 3, xp: current.xp + 3, growth: { ...current.growth, [current.active]: current.xp + 3 } };
  return current.played ? current : { ...current, played: true, xp: current.xp + 2, growth: { ...current.growth, [current.active]: current.xp + 2 } };
}
export function selectCompanion(state: CompanionState, id: CompanionId): CompanionState {
  return COMPANIONS.some((pet) => pet.id === id && pet.threshold <= state.stamps) ? { ...state, active: id, xp: state.growth[id] } : state;
}
export function newlyFilledQuantity(previous: readonly { id: string; qtyCatty: number | null }[], next: readonly { id: string; qtyCatty: number | null }[]): boolean {
  return next.some((entry) => Number.isFinite(entry.qtyCatty) && (entry.qtyCatty ?? 0) > 0 && previous.some((old) => old.id === entry.id && !(Number.isFinite(old.qtyCatty) && (old.qtyCatty ?? 0) > 0)));
}
