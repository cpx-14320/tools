"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "cpx-tools:expenses:openai-key";

/** OpenAI 金鑰只存在這台瀏覽器。
 *
 *  **為什麼不存資料庫**：那是一把可以花使用者的錢的憑證。存進我們的資料庫，我們就變成
 *  它的保管者——要處理加密、輪替、外洩責任。存在瀏覽器、每次用才隨請求送出、伺服器用完
 *  即丟（見 app/api/expenses/ai/parse），我們從頭到尾不持有它。
 *
 *  代價講清楚：換裝置或清掉瀏覽器資料就要重貼一次。這是刻意的取捨，不是沒想到。
 *
 *  **為什麼是共用的 store 而不是各自的 useState**：設定頁的那一列跟金鑰彈窗是兩個不同
 *  的元件，各自拿一份 state 的話，在彈窗裡存好之後，外面那一列還停在「尚未設定」，
 *  要重新整理才會更新。localStorage 是外部狀態，就該用 useSyncExternalStore 訂閱它，
 *  所有訂閱者會在同一刻拿到同一個值。順便也處理掉 SSR（getServerSnapshot）跟「另一個
 *  分頁改了金鑰」（storage 事件）。 */

let cached: string | null = null;
const listeners = new Set<() => void>();

function read(): string {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // 無痕模式／封鎖 storage 的瀏覽器會丟例外。當成沒設定就好，不要讓整頁壞掉。
    cached = "";
  }
  return cached;
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 另一個分頁改了金鑰時同步過來。storage 事件只會在「其他」分頁觸發，所以本頁自己
  // 的修改要靠 writeKey 主動 emit。
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cached = e.newValue ?? "";
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** 伺服器端讀不到 localStorage，一律回空字串。這也讓第一次算繪一定是「尚未設定」，
 *  瀏覽器接手後才會變成真正的值——不會有 hydration 不一致。 */
function getServerSnapshot(): string {
  return "";
}

function writeKey(next: string) {
  const trimmed = next.trim();
  cached = trimmed;
  try {
    if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 同上：存不進去就算了，至少這次操作期間是有值的 */
  }
  emit();
}

export function useAiKey() {
  const key = useSyncExternalStore(subscribe, read, getServerSnapshot);
  return { key, hasKey: key !== "", save: writeKey, clear: () => writeKey("") };
}

/** 顯示用的遮罩：前三碼 ＋ 三個星號 ＋ 後三碼，例如 `sk-***f9c`。
 *
 *  中間固定三個星號、不是一個字元一個星號——星號的數量會洩漏金鑰長度，而且不同長度的
 *  金鑰在清單上會排成參差不齊的一片。使用者要認的是「這是我哪一把」，頭尾六碼就夠了。 */
export function maskKey(key: string): string {
  if (key.length <= 6) return key;
  return `${key.slice(0, 3)}***${key.slice(-3)}`;
}
