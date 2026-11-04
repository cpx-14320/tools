"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cpx-tools:expenses:openai-key";

/** OpenAI 金鑰只存在這台瀏覽器。
 *
 *  **為什麼不存資料庫**：那是一把可以花使用者的錢的憑證。存進我們的資料庫，我們就變成
 *  它的保管者——要處理加密、輪替、外洩責任。存在瀏覽器、每次用才隨請求送出、伺服器用完
 *  即丟（見 app/api/expenses/ai/parse），我們從頭到尾不持有它。
 *
 *  代價講清楚：換裝置或清掉瀏覽器資料就要重貼一次。這是刻意的取捨，不是沒想到。
 *
 *  `ready` 是給 SSR 用的：伺服器讀不到 localStorage，所以第一次算繪一律當作「還不知道」。
 *  直接用 `key === ""` 當「沒設定」的話，伺服器會畫成未設定、瀏覽器接手再跳成已設定，
 *  畫面閃一下，也可能 hydration 對不起來。 */
export function useAiKey() {
  const [{ key, ready }, setState] = useState({ key: "", ready: false });

  useEffect(() => {
    // localStorage 只有瀏覽器有，所以一定得等掛載後才讀——這正是 effect 存在的理由，
    // 不是「可以搬到 render 裡算」的那種。一次 setState 把值跟 ready 一起更新，不要
    // 分兩次觸發兩輪重繪。
    let value = "";
    try {
      value = window.localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      // 無痕模式／封鎖 storage 的瀏覽器會丟例外。當成沒設定就好，不要讓整頁壞掉。
    }
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setState({ key: value, ready: true });
  }, []);

  function save(next: string) {
    const trimmed = next.trim();
    setState({ key: trimmed, ready: true });
    try {
      if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 同上 */
    }
  }

  return { key, ready, hasKey: ready && key !== "", save, clear: () => save("") };
}

/** 顯示用的遮罩：`sk-proj-abcd…7f9c`。
 *
 *  只露頭尾——使用者要認出「這是我哪一把 key」靠的就是尾碼，但整串露出來等於在畫面上
 *  常駐一個憑證，旁邊有人看一眼就抄走了。 */
export function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
