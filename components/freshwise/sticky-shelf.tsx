"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 知道自己「有沒有被釘住」的 sticky 容器。
 *
 * CSS 沒有「我現在被釘住了」這個選擇器，所以用 IntersectionObserver 幫它算出來，寫進
 * `data-stuck`，樣式再掛在那個屬性上。用 IO 而不是監聽 scroll——後者每一幀都要算，
 * 這裡只需要一個布林值。
 *
 * **不需要哨兵元素**：`rootMargin:-1px` 把判定線往下壓一格、`threshold:[1]` 要求「完整
 * 可見」，元素一旦被 sticky 釘住，它的上緣就會卡在那條線上、ratio 掉到 1 以下。以前的
 * 做法是在上面多放一個 1px 的空 div 當哨兵，那個 div 在 DOM 裡沒有任何意義，讀螢幕
 * 軟體與 DOM 檢查都會看到一個解釋不了的東西。
 */
/** `role`／`label` 直接掛在這個容器上。以前呼叫端是在裡面再包一層 `div.contents`
 *  來帶 role，結果 game.css 裡所有 `.fw-category-shelf > button` 的規則都被那一層
 *  擋掉、整組分類樣式等於沒套——有語意就寫在同一個元素上，不要為了 aria 多一層。 */
export function StickyShelf({ children, className = "", role, label }: { children: ReactNode; className?: string; role?: string; label?: string }) {
  const shelf = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = shelf.current;
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        target.dataset.stuck = entry.intersectionRatio < 1 ? "true" : "false";
      },
      // 捲動容器是手機框裡的 <main>，不是視窗。
      { root: target.closest("main"), rootMargin: "-1px 0px 0px 0px", threshold: [1] },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={shelf} className={className} data-stuck="false" role={role} aria-label={label}>
      {children}
    </div>
  );
}
