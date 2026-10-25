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

/** 0 也是一個有效的答案（「這一區上次就是空的」），所以要跟「沒存過」分開。
 *  以前 0 是直接 removeItem，下次讀回來變成 fallback——明明沒有資料卻畫五列骨架，
 *  資料回來只剩一張「還沒有任何資料」的空卡，畫面整個縮一截。 */
export function loadSkeletonCount(key: string, fallback: number, max: number = MAX_SKELETON): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
  } catch {
    // 私密視窗等情況讀不到，用 fallback 猜。
    return fallback;
  }
}

export function saveSkeletonCount(key: string, count: number) {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.round(count))));
  } catch {
    /* 存不進去就放著，下次還是用 fallback */
  }
}

/** 骨架可以畫了嗎——掛載完成才是 true。
 *
 *  列數只有瀏覽器讀得到（localStorage），伺服器端畫出來的一定是 fallback。如果骨架在
 *  伺服器端就畫出來，使用者會先看到 fallback 的五列、hydration 完才換成記住的兩列，
 *  變成「骨架自己先跳一次」。所以骨架一律等掛載後才畫：呼叫端在 !ready 的分支前面先
 *  擋一道 `if (!skeletonReady) return null`，第一次畫出來的就是正確的列數。
 *
 *  掛載 effect 跟抓資料的 effect 是同一輪跑的，所以「什麼都不畫」的那一瞬間只有一個
 *  frame，不會看到空白停留。 */
export function useSkeletonReady(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);
  return mounted;
}

/** 每一頁都要「讀上次的筆數、載入完成後記住這次的筆數」，包成 hook 讓各頁一行接上。
 *
 *  初始值在瀏覽器端就直接讀 localStorage（不是等 effect），搭配上面的 useSkeletonReady
 *  一起用：骨架等掛載後才畫，所以伺服器端跟瀏覽器端算出不同的數字也不會造成 hydration
 *  不一致——那個數字在 hydration 當下根本沒被畫出來。
 *
 *  `actual` 是「這一頁載入完成後實際有幾列」，還在載入時傳 undefined——寫入由這個 hook
 *  自己在 effect 裡做，呼叫端的抓資料流程完全不用動。 */
export function useSkeletonCount(key: string, fallback: number, actual?: number): number {
  const [count, setCount] = useState(() => (typeof window === "undefined" ? fallback : loadSkeletonCount(key, fallback)));

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setCount(loadSkeletonCount(key, fallback));
  }, [key, fallback]);

  useEffect(() => {
    if (actual !== undefined) saveSkeletonCount(key, actual);
  }, [key, actual]);

  return count;
}

function loadSkeletonShape(key: string): number[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const counts = parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
    return counts.slice(0, MAX_SKELETON).map((n) => Math.min(n, MAX_SKELETON));
  } catch {
    return null;
  }
}

/** 巢狀清單（「最近消費」是日期底下再掛幾筆）的骨架形狀：每一組各有幾列。
 *  只記總筆數的話還原不出組數，骨架會少掉每一組之間的日期小標跟間距。 */
export function useSkeletonShape(key: string, fallback: number[], actual?: number[]): number[] {
  const [shape, setShape] = useState(() => (typeof window === "undefined" ? fallback : loadSkeletonShape(key) ?? fallback));
  const actualKey = actual === undefined ? undefined : actual.join(",");

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setShape(loadSkeletonShape(key) ?? fallback);
    // fallback 是字面陣列、每次 render 都是新的參考，放進相依陣列會讓這個 effect 每次
    // 都重跑；它只是「沒存過時用什麼」，不需要追蹤。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (actualKey === undefined) return;
    try {
      localStorage.setItem(key, JSON.stringify(actualKey === "" ? [] : actualKey.split(",").map(Number)));
    } catch {
      /* 忽略 */
    }
  }, [key, actualKey]);

  return shape;
}
