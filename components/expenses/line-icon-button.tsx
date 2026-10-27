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
      className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-[#F3EFFC] hover:text-[#6F5FD6] ${
        active ? "bg-[#F3EFFC] text-[#6F5FD6]" : "text-[#9C94C4]"
      } ${className}`}
      {...rest}
    >
      <LineIcon name={icon} />
    </button>
  );
}
