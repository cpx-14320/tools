// 「我的菜籃」的資料操作。全部是純函式：收進一個舊的 BasketState、回傳一個新的，不改
// 傳進來的物件、不碰 localStorage、不碰網路。
//
// 為什麼要這樣切：菜籃的狀態目前存在瀏覽器的 localStorage（還沒接資料庫），之後會搬到
// MongoDB 的 freshwise.basket。如果「加一筆、刪一筆、換順序」這些規則寫在 React 元件
// 的 setState 裡，搬家的時候就得把規則重寫一次在伺服器端，兩邊很容易長出不一樣的行為
// （記帳本那邊就是把規則放在 lib/expenses/*.ts，API route 與腳本共用同一份）。放在這裡
// 的話，之後 API route 直接 import 同一支函式就好。
//
// 第一層是「分類」（使用者自訂，例如每週常買／火鍋／便當菜），第二層是「項目」。用詞
// 固定叫分類與項目，不要在畫面上出現群組、清單、收藏這些同義詞（見 theme.ts 的 copy）。

import type { BasketEntry, BasketGroup } from "./types";

export interface BasketState {
  groups: BasketGroup[];
  entries: BasketEntry[];
}

/* ───────────────────── 預設內容 ───────────────────── */

/**
 * 新使用者的預設菜籃。空的菜籃對「不懂買菜價格的人」沒有幫助——他連該追蹤什麼都不知道，
 * 看到一個空白頁面只會離開。所以預設就塞一籃最常見的家常菜，使用者可以直接刪掉不要的。
 *
 * 分類的 id 寫死成固定字串（不是隨機產生）是故意的：這份預設值在伺服器端算繪與瀏覽器
 * 端都會被用到，id 每次不一樣的話 React hydration 會對不起來。
 */
export function defaultBasket(): BasketState {
  // 以目前菜籃的四道料理示範分類、食材與份量；只提供給尚未建立菜籃的新帳號。
  // 使用者修改或清空後，依帳號已儲存的內容顯示，不自動補回範本。
  // 固定 id 與每次建立的新陣列，讓伺服器／瀏覽器一致，也不會影響其他使用者。
  const groups: BasketGroup[] = [
    {id: "g-pineapple-shrimp", name: "鳳梨蝦球", icon: "dish-pineapple-shrimp", order: 0},
    {id: "g-mixed-seafood", name: "炒三鮮", icon: "dish-mixed-seafood-stir-fry", order: 1},
    {id: "g-seafood-congee", name: "海鮮粥", icon: "dish-seafood-congee", order: 2},
    {id: "g-oyster-omelet", name: "蚵仔煎", icon: "dish-oyster-omelet", order: 3},
  ];
  const entries: BasketEntry[] = [
    {id: "e-ps-1", groupId: "g-pineapple-shrimp", code: "GA2", qtyCatty: 1, order: 0},
    {id: "e-ps-2", groupId: "g-pineapple-shrimp", code: "HB3", qtyCatty: 1, order: 1},
    {id: "e-ms-1", groupId: "g-mixed-seafood", code: "HB7", qtyCatty: 0.5, order: 0},
    {id: "e-ms-2", groupId: "g-mixed-seafood", code: "HB5", qtyCatty: 0.5, order: 1},
    {id: "e-ms-3", groupId: "g-mixed-seafood", code: "HB4", qtyCatty: 0.5, order: 2},
    {id: "e-ms-4", groupId: "g-mixed-seafood", code: "HB3", qtyCatty: 0.5, order: 3},
    {id: "e-sc-1", groupId: "g-seafood-congee", code: "HB4", qtyCatty: null, order: 0},
    {id: "e-sc-2", groupId: "g-seafood-congee", code: "HB3", qtyCatty: null, order: 1},
    {id: "e-sc-3", groupId: "g-seafood-congee", code: "RA1", qtyCatty: null, order: 2},
    {id: "e-oo-1", groupId: "g-oyster-omelet", code: "HB5", qtyCatty: 1, order: 0},
    {id: "e-oo-2", groupId: "g-oyster-omelet", code: "EA1", qtyCatty: 1, order: 1},
  ];
  return { groups, entries };
}


export function emptyBasket(): BasketState {
  return { groups: [], entries: [] };
}

/* ───────────────────── 小工具 ───────────────────── */

let idCounter = 0;

/** 新 id。菜籃是本機狀態、同一瞬間只有一個使用者在操作，所以時間戳＋遞增序號就夠唯一，
 *  不需要 UUID。之後搬到資料庫時 id 會換成 MongoDB 的 ObjectId，這支就會被移除。 */
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * 把一包來路不明的資料整理成合法的菜籃。
 *
 * 壞掉的那一筆丟掉就好，不要整包放棄——使用者十五個項目裡有一筆欄位缺漏，不該讓
 * 整個菜籃重置。指向已經不存在的分類的項目也丟掉（孤兒項目畫不出來，留著只占空間）。
 *
 * 伺服器端（寫進資料庫前）與舊 localStorage 的搬家都走這一支，驗證規則只有一份。
 */
function stripServings(group: BasketGroup): BasketGroup {
  if (group.servings === undefined) return group;
  const next = { ...group };
  delete next.servings;
  return next;
}

export function normalizeBasket(raw: unknown): BasketState {
  if (!raw || typeof raw !== "object") return emptyBasket();
  const parsed = raw as Partial<BasketState>;
  if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.entries)) return emptyBasket();

  const groups = parsed.groups
    .filter((g): g is BasketGroup => !!g && typeof g.id === "string" && typeof g.name === "string" && typeof g.order === "number")
    // servings 壞掉就當沒填（食譜頁會退回食譜本身的基準份數）。1～20 是刻意設寬的
    // 上下界：真的有人要煮十幾人份，但 0 份、負數、小數都只會讓換算出來的份量變成
    // 看不懂的數字。
    .map((g) => (typeof g.servings === "number" && Number.isInteger(g.servings) && g.servings >= 1 && g.servings <= 20 ? g : stripServings(g)));
  const groupIds = new Set(groups.map((g) => g.id));
  const entries = parsed.entries.filter(
    (e): e is BasketEntry =>
      !!e &&
      typeof e.id === "string" &&
      typeof e.code === "string" &&
      typeof e.order === "number" &&
      typeof e.groupId === "string" &&
      groupIds.has(e.groupId),
  );
  return { groups, entries };
}

/** 重新編號，讓 order 永遠是 0,1,2,… 的連續整數。每次改動都跑一次，不要讓刪除之後留下
 *  0,1,3,4 這種有洞的順序——拖曳排序寫回時會用索引當 order，有洞的話兩邊對不起來。 */
function renumber<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function groupsSorted(state: BasketState): BasketGroup[] {
  return sortByOrder(state.groups);
}

export function entriesOfGroup(state: BasketState, groupId: string): BasketEntry[] {
  return sortByOrder(state.entries.filter((e) => e.groupId === groupId));
}

export function countOfGroup(state: BasketState, groupId: string): number {
  return state.entries.filter((e) => e.groupId === groupId).length;
}

/** 菜籃裡所有不重複的品項代碼（首頁的「我的菜籃今日價」用）。 */
export function allCodes(state: BasketState): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const entry of sortByOrder(state.entries)) {
    if (!seen.has(entry.code)) {
      seen.add(entry.code);
      codes.push(entry.code);
    }
  }
  return codes;
}

export function isInBasket(state: BasketState, code: string): boolean {
  return state.entries.some((e) => e.code === code);
}

/* ───────────────────── 分類 ───────────────────── */

export function addGroup(state: BasketState, name: string, icon: string): BasketState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const group: BasketGroup = { id: newId("g"), name: trimmed, icon, order: state.groups.length };
  return { ...state, groups: renumber([...groupsSorted(state), group]) };
}

export function updateGroup(state: BasketState, groupId: string, patch: { name?: string; icon?: string; servings?: number }): BasketState {
  return {
    ...state,
    groups: state.groups.map((group) => {
      if (group.id !== groupId) return group;
      const name = patch.name?.trim();
      return {
        ...group,
        name: name || group.name,
        icon: patch.icon ?? group.icon,
        servings: patch.servings ?? group.servings,
      };
    }),
  };
}

/** 刪分類連裡面的項目一起刪。保留孤兒項目的話它們會從畫面上消失但還占著儲存空間，
 *  而且之後新增同名分類時會突然冒出來。 */
export function deleteGroup(state: BasketState, groupId: string): BasketState {
  return {
    groups: renumber(groupsSorted(state).filter((g) => g.id !== groupId)),
    entries: state.entries.filter((e) => e.groupId !== groupId),
  };
}

export function reorderGroups(state: BasketState, orderedIds: string[]): BasketState {
  const byId = new Map(state.groups.map((g) => [g.id, g]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter((g): g is BasketGroup => !!g);
  // 傳進來的清單漏掉的分類（理論上不該發生，但不要因此把資料弄丟）補在後面。
  const missing = groupsSorted(state).filter((g) => !orderedIds.includes(g.id));
  return { ...state, groups: renumber([...reordered, ...missing]) };
}

/* ───────────────────── 項目 ───────────────────── */

/** 加一筆到指定分類。同一個分類裡已經有同一個品項就不重複加（回傳原狀態），不同分類
 *  可以各有一筆（火鍋跟每週常買都想追蹤高麗菜是很合理的）。 */
export function addEntry(state: BasketState, groupId: string, code: string, qtyCatty: number | null = null): BasketState {
  if (!state.groups.some((g) => g.id === groupId)) return state;
  if (state.entries.some((e) => e.groupId === groupId && e.code === code)) return state;
  const entry: BasketEntry = {
    id: newId("e"),
    groupId,
    code,
    qtyCatty: qtyCatty !== null && qtyCatty > 0 ? qtyCatty : null,
    order: countOfGroup(state, groupId),
  };
  return { ...state, entries: [...state.entries, entry] };
}

export function updateEntry(state: BasketState, entryId: string, patch: { qtyCatty?: number | null; groupId?: string }): BasketState {
  const target = state.entries.find((e) => e.id === entryId);
  if (!target) return state;

  // 換分類時 order 要重新接在新分類的最後面，不然會跟新分類裡既有的項目搶同一個順序。
  const movingToOtherGroup = patch.groupId !== undefined && patch.groupId !== target.groupId;
  const nextOrder = movingToOtherGroup ? countOfGroup(state, patch.groupId as string) : target.order;

  const entries = state.entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          qtyCatty:
            patch.qtyCatty === undefined ? entry.qtyCatty : patch.qtyCatty !== null && patch.qtyCatty > 0 ? patch.qtyCatty : null,
          groupId: patch.groupId ?? entry.groupId,
          order: nextOrder,
        }
      : entry,
  );

  // 搬走之後原分類會留下順序的洞，重新編號一次。
  if (movingToOtherGroup) {
    const oldGroupEntries = renumber(sortByOrder(entries.filter((e) => e.groupId === target.groupId)));
    const others = entries.filter((e) => e.groupId !== target.groupId);
    return { ...state, entries: [...others, ...oldGroupEntries] };
  }
  return { ...state, entries };
}

export function removeEntry(state: BasketState, entryId: string): BasketState {
  const target = state.entries.find((e) => e.id === entryId);
  if (!target) return state;
  const remaining = state.entries.filter((e) => e.id !== entryId);
  const sameGroup = renumber(sortByOrder(remaining.filter((e) => e.groupId === target.groupId)));
  const others = remaining.filter((e) => e.groupId !== target.groupId);
  return { ...state, entries: [...others, ...sameGroup] };
}

export function reorderEntries(state: BasketState, groupId: string, orderedIds: string[]): BasketState {
  const inGroup = new Map(state.entries.filter((e) => e.groupId === groupId).map((e) => [e.id, e]));
  const reordered = orderedIds.map((id) => inGroup.get(id)).filter((e): e is BasketEntry => !!e);
  const missing = entriesOfGroup(state, groupId).filter((e) => !orderedIds.includes(e.id));
  const others = state.entries.filter((e) => e.groupId !== groupId);
  return { ...state, entries: [...others, ...renumber([...reordered, ...missing])] };
}

/**
 * 行情頁那顆星星：還沒在菜籃裡就加進第一個分類，已經在裡面就整個移除（不管它在哪幾個
 * 分類）。
 *
 * 一顆星同時負責「加入」與「移除」是刻意的——行情清單一列只有一個小小的星星可以點，
 * 不可能在那裡放一個分類選擇器。想放到特定分類的人會去我的菜籃頁用「＋ 新增項目」，
 * 那裡才有完整的分類選擇。
 */
export function toggleBasket(state: BasketState, code: string, groupId?: string): BasketState {
  if (isInBasket(state, code)) {
    const remaining = state.entries.filter((e) => e.code !== code);
    // 每個被影響到的分類都要重新編號。
    const groupIds = new Set(state.entries.filter((e) => e.code === code).map((e) => e.groupId));
    let entries = remaining;
    for (const groupId of groupIds) {
      const sameGroup = renumber(sortByOrder(entries.filter((e) => e.groupId === groupId)));
      entries = [...entries.filter((e) => e.groupId !== groupId), ...sameGroup];
    }
    return { ...state, entries };
  }

  // 呼叫端指定了分類就用它（行情頁會先問「要加到哪一籃」）；沒指定才用第一個。
  const target = groupId && state.groups.some((g) => g.id === groupId) ? groupId : groupsSorted(state)[0]?.id;
  // 使用者刪光分類後，主動加入食材時才建立一個分類，不自動補回預設料理。
  if (!target) {
    const withGroup = addGroup(state, "我的菜籃", "basket-shopping");
    return addEntry(withGroup, groupsSorted(withGroup)[0].id, code);
  }
  return addEntry(state, target, code);
}
