// 我的菜籃的本機儲存。只能在瀏覽器端呼叫（"use client" 的元件或 effect 裡）。
//
// 偏好設定（場所／單位／市場）**不在這裡**，在 cookie 裡（見 prefs-cookie.ts）——價格是
// 伺服器端算的，伺服器必須在算繪時就知道要算哪個場所，而 localStorage 伺服器讀不到。
// 菜籃是會成長的清單，不適合每個請求都帶上去，所以留在 localStorage。
//
// 每一支都包 try/catch：localStorage 在無痕模式、或使用者把網站資料存取關掉時會直接丟
// 例外，不是回傳 null。那種情況下這個工具應該照樣能查行情（只是菜籃不會被記住），不該
// 整頁白掉。

import { defaultBasket, type BasketState } from "./basket";
import { PREFS_COOKIE } from "./prefs-cookie";

const BASKET_KEY = "freshwise.basket";

/**
 * 讀菜籃。**完全沒存過**（第一次用）回傳 null，由呼叫端決定要塞預設菜籃；存過但是空的
 * （使用者自己把所有分類都刪了）回傳那個空的狀態。
 *
 * 這兩種情況一定要分得開：都當成 null 的話，使用者刪光菜籃、重新整理一次，預設的那幾樣
 * 菜又全部回來，看起來像刪不掉。
 */
export function loadBasket(): BasketState | null {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BasketState>;
    if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.entries)) return null;

    // 逐筆檢查必要欄位，壞掉的那一筆丟掉就好，不要整包放棄。
    const groups = parsed.groups.filter(
      (g): g is BasketState["groups"][number] =>
        !!g && typeof g.id === "string" && typeof g.name === "string" && typeof g.order === "number",
    );
    const groupIds = new Set(groups.map((g) => g.id));
    const entries = parsed.entries.filter(
      (e): e is BasketState["entries"][number] =>
        !!e &&
        typeof e.id === "string" &&
        typeof e.code === "string" &&
        typeof e.order === "number" &&
        // 指向已經不存在的分類的項目直接丟掉（孤兒項目畫不出來，留著只會占空間）。
        typeof e.groupId === "string" &&
        groupIds.has(e.groupId),
    );
    return { groups, entries };
  } catch {
    return null;
  }
}

export function saveBasket(state: BasketState): void {
  try {
    localStorage.setItem(BASKET_KEY, JSON.stringify(state));
  } catch {
    // 存不進去就算了，這一輪的操作在記憶體裡還是生效的，只是重新整理後會回到上一次的狀態。
  }
}

/** 設定頁的「清除全部資料」：菜籃（localStorage）與偏好（cookie）一起清掉。 */
export function clearFreshwiseStorage(): void {
  try {
    localStorage.removeItem(BASKET_KEY);
  } catch {
    // 清不掉也沒辦法，呼叫端已經把記憶體裡的狀態重設了。
  }
  if (typeof document !== "undefined") {
    // max-age=0 是刪 cookie 的標準做法；path 要跟寫入時一致，不然刪到的是另一個 cookie。
    document.cookie = `${PREFS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
}

/** 把菜籃重設成預設內容（設定頁的「還原預設菜籃」）。 */
export function resetBasket(): BasketState {
  const fresh = defaultBasket();
  saveBasket(fresh);
  return fresh;
}
