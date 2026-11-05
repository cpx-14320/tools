"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

/** localStorage 鍵的前綴。真正用的鍵是 `${PREFIX}:${userId}`，見 AiKeyScopeProvider。 */
const PREFIX = "cpx-tools:expenses:openai-key";

/** 舊版那一把沒有帳號區隔的鍵。同一台瀏覽器上所有帳號共用同一格，換帳號登入會直接
 *  繼承前一個人的金鑰（看得到遮罩、也用得下去）。已經改成一人一格，這一把只剩清掉的
 *  價值——留著它就是留著那個洞。見 clearLegacyKey()。 */
const LEGACY_STORAGE_KEY = PREFIX;

/** OpenAI 金鑰只存在這台瀏覽器，而且**一個帳號一格**。
 *
 *  **為什麼不存資料庫**：那是一把可以花使用者的錢的憑證。存進我們的資料庫，我們就變成
 *  它的保管者——要處理加密、輪替、外洩責任。存在瀏覽器、每次用才隨請求送出、伺服器用完
 *  即丟（見 app/api/expenses/ai/parse），我們從頭到尾不持有它。
 *
 *  **為什麼要照 userId 分格**：localStorage 是綁瀏覽器、不是綁帳號的。早期只用一個固定
 *  的鍵，結果是 A 設好金鑰、登出，B 在同一台電腦註冊新帳號，一進 AI 記帳就看到「已設定
 *  API Key」——那是 A 的，B 可以直接拿去花 A 的錢。鍵加上 userId 之後，換帳號就是換一格，
 *  各自的金鑰互相看不到。
 *
 *  代價講清楚：換裝置、換瀏覽器或清掉瀏覽器資料就要重貼一次。這是刻意的取捨，不是沒想到。
 *
 *  **還擋不住什麼**：同一台瀏覽器、同一個帳號登入的人仍然看得到那一把。localStorage 存
 *  的東西本來就跟著「這台瀏覽器 + 這個帳號」走，要再往下擋就得改成不落地（每次用才問），
 *  那是另一個取捨。
 *
 *  **為什麼是共用的 store 而不是各自的 useState**：設定頁的那一列跟金鑰彈窗是兩個不同
 *  的元件，各自拿一份 state 的話，在彈窗裡存好之後，外面那一列還停在「尚未設定」，
 *  要重新整理才會更新。localStorage 是外部狀態，就該用 useSyncExternalStore 訂閱它，
 *  所有訂閱者會在同一刻拿到同一個值。順便也處理掉 SSR（getServerSnapshot）跟「另一個
 *  分頁改了金鑰」（storage 事件）。 */

/** 目前登入者的 id。空字串＝不知道是誰（SSR、或忘了包 Provider），這時候一律當作
 *  「沒有金鑰」而且存不進去——寧可讓功能看起來沒設定，也不要退回那個全帳號共用的鍵。 */
const UserIdContext = createContext("");

/** 包在記帳本外殼上（見 components/expenses/expenses-shell.tsx），讓底下所有用到
 *  useAiKey 的元件知道金鑰要讀哪一格。 */
export function AiKeyScopeProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <UserIdContext.Provider value={userId}>{children}</UserIdContext.Provider>;
}

/** 每一格各自的值與訂閱者。key 是完整的 localStorage 鍵。 */
const cache = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function read(storageKey: string): string {
  const hit = cache.get(storageKey);
  if (hit !== undefined) return hit;
  let value = "";
  try {
    value = window.localStorage.getItem(storageKey) ?? "";
  } catch {
    // 無痕模式／封鎖 storage 的瀏覽器會丟例外。當成沒設定就好，不要讓整頁壞掉。
  }
  cache.set(storageKey, value);
  return value;
}

function emit(storageKey: string) {
  for (const listener of listeners.get(storageKey) ?? []) listener();
}

function write(storageKey: string, next: string) {
  // 不知道是誰就不要寫——寫了也只會寫進一個沒人會再讀到的格子。
  if (!storageKey) return;
  const trimmed = next.trim();
  cache.set(storageKey, trimmed);
  try {
    if (trimmed) window.localStorage.setItem(storageKey, trimmed);
    else window.localStorage.removeItem(storageKey);
  } catch {
    /* 同上：存不進去就算了，至少這次操作期間是有值的 */
  }
  emit(storageKey);
}

/** 把舊版那一把全帳號共用的金鑰從瀏覽器裡刪掉。
 *
 *  刻意**不**把它搬進現在這個人的格子：沒有任何辦法知道當初是誰貼的，搬過去就等於把
 *  別人的金鑰正式發給這個帳號——正是要修掉的那件事。代價是原本設過的人要重貼一次，
 *  這比繼續共用划算。 */
let legacyCleared = false;
function clearLegacyKey() {
  if (legacyCleared) return;
  legacyCleared = true;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* 清不掉就算了，反正現在也沒有人會去讀它 */
  }
}

/** 伺服器端讀不到 localStorage，一律回空字串。這也讓第一次算繪一定是「尚未設定」，
 *  瀏覽器接手後才會變成真正的值——不會有 hydration 不一致。 */
function getServerSnapshot(): string {
  return "";
}

export function useAiKey() {
  const userId = useContext(UserIdContext);
  const storageKey = userId ? `${PREFIX}:${userId}` : "";

  const subscribe = useCallback(
    (listener: () => void) => {
      // 這裡是 effect 階段，做副作用是安全的（getSnapshot 不行）。
      clearLegacyKey();
      if (!storageKey) return () => {};

      let set = listeners.get(storageKey);
      if (!set) {
        set = new Set();
        listeners.set(storageKey, set);
      }
      set.add(listener);

      // 另一個分頁改了金鑰時同步過來。storage 事件只會在「其他」分頁觸發，所以本頁
      // 自己的修改要靠 write 主動 emit。
      const onStorage = (e: StorageEvent) => {
        if (e.key !== storageKey) return;
        cache.set(storageKey, e.newValue ?? "");
        emit(storageKey);
      };
      window.addEventListener("storage", onStorage);

      return () => {
        set.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [storageKey],
  );

  const getSnapshot = useCallback(() => (storageKey ? read(storageKey) : ""), [storageKey]);

  const key = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      key,
      hasKey: key !== "",
      save: (next: string) => write(storageKey, next),
      clear: () => write(storageKey, ""),
    }),
    [key, storageKey],
  );
}

/** 顯示用的遮罩：前三碼 ＋ 三個星號 ＋ 後三碼，例如 `sk-***f9c`。
 *
 *  中間固定三個星號、不是一個字元一個星號——星號的數量會洩漏金鑰長度，而且不同長度的
 *  金鑰在清單上會排成參差不齊的一片。使用者要認的是「這是我哪一把」，頭尾六碼就夠了。 */
export function maskKey(key: string): string {
  if (key.length <= 6) return key;
  return `${key.slice(0, 3)}***${key.slice(-3)}`;
}
