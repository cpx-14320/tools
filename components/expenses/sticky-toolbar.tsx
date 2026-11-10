"use client";

import type { ReactNode } from "react";

/** 捲動時黏在卡片頂端的模式工具列（分頁切換＋排序／選取那一列）。
 *
 *  **為什麼需要**：分類清單有二十幾張卡，進排序模式滑到最底下調整完，要按的「完成」
 *  卻還在最上面——每調一次就要整頁滑回去一次。選取模式也一樣。把這一列釘住之後，不管
 *  捲到哪裡，結束這個模式的出口都在手指附近。
 *
 *  **為什麼 sticky 在這裡真的有效**：外殼那張手機卡片是固定高度、由 `<main>` 自己
 *  `overflow-y-auto` 捲動（見 expenses-mobile-shell.tsx），sticky 的參考對象就是那個
 *  捲動容器，`top-0` 黏的是卡片頂端而不是瀏覽器視窗頂端。
 *
 *  `-mx-5 px-5` 是為了讓背景鋪滿整個卡片寬度：外層內容區有 20px 的左右留白，不往外
 *  擴的話，黏住時兩側會露出一條縫，底下的內容從縫裡穿過去。
 *
 *  背景用「接近不透明的底色＋backdrop blur」而不是純色：卡片底色是漸層，純色在捲動到
 *  不同位置時會跟背後對不起來，糊一下就看不出接縫。 */
export function StickyToolbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`sticky top-0 z-20 -mx-5 bg-[#EDE6FB]/95 px-5 pb-2.5 pt-2.5 backdrop-blur-sm ${className}`}>{children}</div>
  );
}
