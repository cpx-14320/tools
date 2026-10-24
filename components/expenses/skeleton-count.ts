// 記帳本的清單筆數大多是使用者自己決定的（分類幾個、帳戶幾個、這個月記了幾筆），
// 骨架不能寫死固定幾列——資料回來那一刻骨架列數跟實際筆數對不上的話，畫面高度會跳
// 一下，比沒有骨架還糟。用 localStorage 記住「上次成功載入時的實際筆數」，下次還沒
// 抓到資料前先用這個數字猜，猜對的機率比寫死高很多；沒存過（第一次用）才退回 fallback。
//
// 做法比照搭乘車的 components/transit/skeleton-count.ts，但兩邊刻意不共用（記帳本的
// 元件自成一套，見 expenses-mobile-shell.tsx 開頭的說明）。

"use client";

import { useEffect, useState } from "react";

/** 再長的清單超出第一屏的部分本來就看不到，畫上百列骨架只會讓載入本身變慢。 */
const MAX_SKELETON = 12;

export function loadSkeletonCount(key: string, fallback: number, max: number = MAX_SKELETON): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
  } catch {
    // 私密視窗等情況讀不到，用 fallback 猜。
    return fallback;
  }
}

export function saveSkeletonCount(key: string, count: number) {
  try {
    if (count > 0) localStorage.setItem(key, String(count));
    else localStorage.removeItem(key);
  } catch {
    /* 存不進去就放著，下次還是用 fallback */
  }
}

/** 每一頁都要「掛載後讀上次的筆數、載入完成後記住這次的筆數」，包成 hook 讓各頁一行接上。
 *
 *  初始值一律是 fallback、localStorage 等掛載後才讀：這些頁在伺服器端也會先算繪一次
 *  （那時 ready 還是 false，畫的就是骨架），在 useState 的初始值裡讀 localStorage 會讓
 *  伺服器跟瀏覽器算出不同的列數，hydration 就會失敗。讀取的 effect 在抓資料之前就跑完，
 *  所以使用者看到的還是記住的那個數字。
 *
 *  `actual` 是「這一頁載入完成後實際有幾列」，還在載入時傳 undefined——寫入由這個 hook
 *  自己在 effect 裡做，呼叫端的抓資料流程完全不用動。 */
export function useSkeletonCount(key: string, fallback: number, actual?: number): number {
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setCount(loadSkeletonCount(key, fallback));
  }, [key, fallback]);

  useEffect(() => {
    if (actual !== undefined) saveSkeletonCount(key, actual);
  }, [key, actual]);

  return count;
}
