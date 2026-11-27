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

/**
 * 使用者替某隻夥伴挑的外觀階段。`0` ＝ 跟等級走（預設）。
 *
 * 為什麼要有這個：升到第三階之後就再也看不到第一、二階的樣子了，而那兩階是使用者陪著
 * 長大的過程。預設仍然是跟等級走——升級要看得到變化，不然升級沒有意義；想回去看舊樣子
 * 的人自己去圖鑑挑。只能挑**已經長到過**的階段（見 chooseCompanionLook）。
 */
export type LookChoice = 0 | 1 | 2 | 3;
/** 每次完成今日任務可獲得的探索印章，顯示與實際領取共用。 */
export const QUEST_STAMP_REWARD = 4;

/** 澆水一次要花多少露珠。新帳號的露珠是 **0**（見 initialCompanionState）——澆水是
 *  「完成任務換來的獎勵」，一開始就送一壺水會讓第一次澆水變成沒有來由的事。
 *  畫面上的按鈕文案、disabled 判斷與這裡的扣款**一律用這個常數**
 *  ——以前是三個地方各寫一個 3，改數字時漏掉按鈕就會變成「按得下去但沒反應」。 */
export const WATER_DEW_COST = 10;

/** 澆水一次加多少成長值，陪玩一次加多少。**畫面上的提示文字不要自己寫死數字**——
 *  store 的 care() 是拿「實際增加了多少」去組句子（`next.xp - 目前的 xp`），所以這兩個
 *  數字改了，訊息會自己跟著變。 */
export const WATER_XP_GAIN = 10;
export const PLAY_XP_GAIN = 10;
export const QUESTS = [
  { id: "explore", title: "和夥伴逛逛行情", description: "看看 3 種不同食材的價格", target: 3, reward: 20, href: "/tools/freshwise/browse", icon: "market" },
  { id: "chart", title: "學會看價格走勢", description: "在有走勢的詳情頁切換一次期間", target: 1, reward: 20, href: "/tools/freshwise/browse", icon: "chart" },
  { id: "basket", title: "整理自己的採買份量", description: "幫菜籃中還沒填份量的項目填好份量", target: 1, reward: 20, href: "/tools/freshwise/basket", icon: "basket" },
] as const;
export interface CompanionState {
  version: 1;
  day: string;
  dew: number;
  xp: number;
  growth: Record<CompanionId, number>;
  stamps: number;
  active: CompanionId;
  /** 每隻夥伴各自的外觀選擇（0＝跟等級走）。 */
  look: Record<CompanionId, LookChoice>;
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
  return { version: 1, day, dew: 0, xp: 0, growth: { cabbage: 0, radish: 0, strawberry: 0, pumpkin: 0, eggplant: 0, corn: 0 }, stamps: 0, active: "cabbage", look: { cabbage: 0, radish: 0, strawberry: 0, pumpkin: 0, eggplant: 0, corn: 0 }, visited: [], chart: false, basket: false, played: false, claimed: [] };
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
    // 外觀選擇是後來才加的欄位，舊資料沒有——缺就是 0（跟等級走），跟新帳號一樣。
    const storedLook = s.look && typeof s.look === "object" ? s.look as Record<string, unknown> : {};
    const look = Object.fromEntries(COMPANIONS.map((pet) => {
      const raw = storedLook[pet.id];
      return [pet.id, raw === 1 || raw === 2 || raw === 3 ? raw : 0];
    })) as Record<CompanionId, LookChoice>;
    return dailyState({ ...fallback, day: typeof s.day === "string" ? s.day : day,
      dew: safeCount(s.dew, 0), xp: growth[active], growth, stamps, active, look,
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

/** 成長值換算成等級。`companionLevel`（陪伴中的那隻）與圖鑑裡每一隻都用這一條，
 *  不要再寫一次 `1 + Math.floor(xp / 40)`。 */
export function levelOf(xp: number): number {
  return 1 + Math.floor(xp / XP_PER_LEVEL);
}

export function companionLevel(state: CompanionState): CompanionLevel {
  const pet = COMPANIONS.find((p) => p.id === state.active) ?? COMPANIONS[0];
  const level = levelOf(state.xp);
  return {
    level,
    progress: state.xp % XP_PER_LEVEL,
    max: XP_PER_LEVEL,
    label: `Lv.${level} ${pet.nickname}`,
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
  return { ...current, claimed: [...current.claimed, id], dew: current.dew + quest.reward, stamps: current.stamps + QUEST_STAMP_REWARD };
}
export function careForCompanion(state: CompanionState, action: "water" | "play", day: string): CompanionState {
  const current = dailyState(state, day);
  if (action === "water") return current.dew < WATER_DEW_COST ? current : { ...current, dew: current.dew - WATER_DEW_COST, xp: current.xp + WATER_XP_GAIN, growth: { ...current.growth, [current.active]: current.xp + WATER_XP_GAIN } };
  return current.played ? current : { ...current, played: true, xp: current.xp + PLAY_XP_GAIN, growth: { ...current.growth, [current.active]: current.xp + PLAY_XP_GAIN } };
}
/**
 * 替某隻夥伴挑外觀階段。
 *
 * 只收「已經長到過」的階段：還沒升到第三階就把樣子換成第三階，等於提前看到獎勵，升級
 * 那一刻就沒有變化了。夥伴本身沒解鎖（印章不夠）也不能挑。驗不過一律回原狀態，不要丟
 * 錯——這是從畫面按下來的，而畫面已經把不能挑的按鈕 disable 了，真的送到這裡就是網址
 * 或 API 被人改過。
 */
export function chooseCompanionLook(state: CompanionState, id: CompanionId, choice: LookChoice): CompanionState {
  const pet = COMPANIONS.find((p) => p.id === id);
  if (!pet || pet.threshold > state.stamps) return state;
  const reached = unlockedStage(levelOf(state.growth[id]));
  if (choice !== 0 && choice > reached) return state;
  return { ...state, look: { ...state.look, [id]: choice } };
}

/** 這個等級已經長到第幾階。門檻跟 pet-expressions.ts 的 petStage 是同一組
 *  （1–3 嫩芽、4–7 成長、8+ 成熟）——那邊負責「畫哪一張圖」，這裡負責「能不能挑」。 */
export function unlockedStage(level: number): 1 | 2 | 3 {
  return level >= 8 ? 3 : level >= 4 ? 2 : 1;
}

export function selectCompanion(state: CompanionState, id: CompanionId): CompanionState {
  return COMPANIONS.some((pet) => pet.id === id && pet.threshold <= state.stamps) ? { ...state, active: id, xp: state.growth[id] } : state;
}
export function newlyFilledQuantity(previous: readonly { id: string; qtyCatty: number | null }[], next: readonly { id: string; qtyCatty: number | null }[]): boolean {
  return next.some((entry) => Number.isFinite(entry.qtyCatty) && (entry.qtyCatty ?? 0) > 0 && previous.some((old) => old.id === entry.id && !(Number.isFinite(old.qtyCatty) && (old.qtyCatty ?? 0) > 0)));
}
