/* ─────────────────────────────────────────────────────────────────────────────
 * 目前沒有任何地方用到這個檔案。
 *
 * 記帳本的 13 頁已經全部改成 Server Component：資料在 page.tsx 於伺服器讀好當 props
 * 傳進來，畫面第一次畫出來就是有資料的，沒有「載入中」這個狀態可以給骨架用。
 *
 * 刻意留著不刪：這一整套骨架是照著每一頁實際的版面一塊一塊量出來的（列高、縮排、
 * 卡片間距、有沒有展開鈕都對齊過真畫面），重做一次的成本遠高於留著。之後只要出現
 * 「這一塊的資料沒辦法在伺服器讀完」的情況就會需要它，例如：
 *   - 某一區改成讀外部 API（會慢、會掛，不適合擋住整頁的 HTML）
 *   - 用 <Suspense> 把慢的那一塊拆出去串流，fallback 就是這裡的元件
 *   - 加 loading.tsx 讓換頁當下立刻有回饋（現在換頁會有約 0.7 秒畫面不動）
 *
 * 要用回來的話：搭配 skeleton-count.ts 的 useSkeletonCount／useSkeletonShape 記住
 * 上次的實際筆數，骨架列數才會跟資料回來後一致。
 * ──────────────────────────────────────────────────────────────────────────── */

// 記帳本的清單筆數大多是使用者自己決定的（分類幾個、帳戶幾個、這個月記了幾筆），
// 骨架不能寫死固定幾列——資料回來那一刻骨架列數跟實際筆數對不上的話，畫面高度會跳
// 一下，比沒有骨架還糟。用 localStorage 記住「上次成功載入時的實際筆數」，下次還沒
// 抓到資料前先用這個數字猜，猜對的機率比寫死高很多；沒存過（第一次用）才退回 fallback。
//
// 做法比照搭乘車的 components/transit/skeleton-count.ts，但兩邊刻意不共用（記帳本的
// 元件自成一套，見 expenses-mobile-shell.tsx 開頭的說明）。

"use client";

import { useEffect, useRef, useState } from "react";

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

/** 骨架要等「載入真的慢到會被察覺」才畫。
 *
 *  `loading` 一變 true 不立刻顯示，先等 DELAY_MS；資料在那之前就回來了就整個不畫——
 *  快的時候閃一下骨架再換成內容，比直接等內容還吵。人對「畫面沒反應」的容忍大約是
 *  100ms，超過 300ms 才開始覺得卡，所以 250ms 之前不畫是安全的。
 *
 *  一旦畫了就至少停 MIN_VISIBLE_MS 再收：資料在第 260ms 回來的話，骨架只存在 10ms，
 *  那是比不顯示更糟的一閃。
 *
 *  這個 hook 也同時取代了原本的 useSkeletonReady——它回傳的第一個值一定是 false
 *  （計時器只在瀏覽器端跑），伺服器端跟 hydration 當下畫出來的都是「沒有骨架」，
 *  不會有兩邊對不起來的問題。 */
const DELAY_MS = 250;
const MIN_VISIBLE_MS = 400;

export function useSkeletonVisible(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, DELAY_MS);
      return () => clearTimeout(timer);
    }
    // 載入結束：還沒畫出來就直接不畫；已經畫了就補滿最短顯示時間再收。
    let cancelled = false;
    const shownFor = shownAt.current === 0 ? Infinity : Date.now() - shownAt.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - shownFor);
    const timer = setTimeout(() => {
      if (!cancelled) setVisible(false);
    }, remaining);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loading]);

  return visible;
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
