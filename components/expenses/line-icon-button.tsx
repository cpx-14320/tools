"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** 線條風格的圓形圖示按鈕——跟首頁那顆「遮金額」的眼睛（hidden-amounts.tsx）同一組視覺：
 *  size-8 的圓、平常是淡紫灰的線條、hover 才浮出淡紫底。
 *
 *  跟 icon-button.tsx 的 IconButton 是兩種東西，不要混用：
 *  - IconButton 走 Font Awesome 的 `fa-solid`（實心），字型本身沒有線條版可以選，所以
 *    縮到 14px 看起來又黑又重。它適合「鉛筆」「＋」「－」這種小到只剩輪廓、要夠實才
 *    看得見的操作鈕。
 *  - 這一顆走手寫的 SVG，stroke-width 固定 1.8，筆畫粗細跟眼睛、跟整頁的插畫一致。
 *    放在日期膠囊那種淡邊框旁邊時，實心圖會比旁邊所有東西都重一階，線條才壓得住。
 *
 *  圖示自己畫在下面的 LINE_ICONS 裡，用到再加——不另外裝一套線條圖示字型，為了兩三顆
 *  圖多拉一份 webfont 進來不划算，而且字型版的粗細跟這裡的 1.8 也對不起來。 */
const LINE_ICONS: Record<string, ReactNode> = {
  /** 月曆：外框加上面兩根掛環、底下一條分隔線。 */
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="15.5" rx="3.2" />
      <path d="M8 3v4M16 3v4M3.2 9.8h17.6" />
    </>
  ),
  /** 漏斗：上寬下窄收到中線（x=12），再掛一截手把。 */
  filter: <path d="M3.5 5.5h17L14 13.2v5.4L10 16.6v-3.4L3.5 5.5Z" />,
  /** 轉帳：上下兩根反方向的箭頭（錢從一個帳戶搬到另一個）。上面那根往右、下面那根
   *  往左，兩根各自帶一個箭頭——只畫一根雙箭頭的線看起來像「交換排序」，兩根才讀得出
   *  是兩筆相反方向的流動。 */
  transfer: <path d="M3.8 9.2h15.4M16 6l3.2 3.2L16 12.4M20.2 14.8H4.8M8 11.6l-3.2 3.2L8 18" />,
};

export type LineIconName = keyof typeof LINE_ICONS;

export function LineIcon({ name, className = "size-5" }: { name: LineIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {LINE_ICONS[name]}
    </svg>
  );
}

export function LineIconButton({
  icon,
  active = false,
  className = "",
  ...rest
}: {
  icon: LineIconName;
  /** 這顆按鈕代表的東西正在生效（例如篩選有設條件）——線條轉紫、底色常亮，就是
   *  hover 的那個樣子固定住，不用另外發明一種「開著」的配色。 */
  active?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className">) {
  return (
    <button
      type="button"
      // 平常就有淡紫底（bg-[#F3EFFC]，跟多選工具列、pill 選單同一個底色）：這顆鈕原本
      // 只有線條、沒有底，擺在日期膠囊旁邊看起來像漂在那裡、不像一顆可以按的東西。
      // disabled 的那一組：線條淡到跟邊框同一階，而且不要再有 hover 的變紫——不壓掉的話
      // 按不動的鈕摸上去照樣會亮，看起來像沒反應的 bug。
      className={`grid size-8 shrink-0 place-items-center rounded-full bg-[#F3EFFC] transition-colors hover:text-[#6F5FD6] disabled:text-[#C7BFE6] disabled:hover:text-[#C7BFE6] ${
        active ? "text-[#6F5FD6]" : "text-[#9C94C4]"
      } ${className}`}
      {...rest}
    >
      <LineIcon name={icon} />
    </button>
  );
}
