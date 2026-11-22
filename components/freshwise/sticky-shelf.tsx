"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 捲到頂端被釘住時才給底色的容器。
 *
 * 分類列平常是透明的（讓底下的紙紋透出來），但一旦 sticky 生效、清單從它後面穿過去，
 * 沒有底色就會看到字疊在字上面。CSS 沒有「我現在被釘住了」這個選擇器，所以在它上面
 * 放一個 1px 的哨兵：哨兵離開畫面＝已經釘住。
 *
 * 用 IntersectionObserver 而不是監聽 scroll——後者每一幀都要算，而這裡只需要知道
 * 「越過了沒有」這一個布林值。
 */
export function StickyShelf({ children, className = "" }: { children: ReactNode; className?: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const shelf = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mark = sentinel.current;
    const target = shelf.current;
    if (!mark || !target) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        target.dataset.stuck = entry.isIntersecting ? "false" : "true";
      },
      // 捲動容器是手機框裡的 <main>，不是視窗。
      { root: target.closest("main"), threshold: 0 },
    );
    io.observe(mark);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div ref={shelf} className={className} data-stuck="false">
        {children}
      </div>
    </>
  );
}
