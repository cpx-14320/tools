"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { FaIcon } from "./fa-icon";

type Tone = "plain" | "soft" | "white" | "solid";

/** 四種底色，對齊搭乘車那邊實際用到的幾種：
 *  plain＝只有圖示；soft＝淡紫底；white＝白底細框加陰影（搭乘車首頁疊在主視覺上的
 *  「編輯」那顆）；solid＝純白底沒有框（搭乘車班次結果頁左上角的返回鍵）。 */
const TONE_CLASS: Record<Tone, string> = {
  plain: "text-[#6F5FD6] hover:bg-[#F3EFFC]",
  soft: "bg-[#F3EFFC] text-[#6F5FD6]",
  white: "border border-[#ECE4FA] bg-white/80 text-[#6F5FD6] shadow-sm backdrop-blur",
  solid: "bg-white text-[#6F5FD6]",
};

/** 圓形的圖示按鈕——鉛筆、箭頭這種「一個動作一顆小圓鈕」。
 *
 *  圖示走 Font Awesome（FaIcon）而不是 emoji：emoji 在不同作業系統長得完全不一樣
 *  （原本的 ✏️ 在 Windows 是黃色鉛筆、在 iOS 是另一種配色），而且吃不到 currentColor，
 *  沒辦法跟著品牌紫走。規格刻意比照搭乘車那顆，兩個工具的小圓鈕才是同一個視覺語言
 *  ——但照記帳本的慣例各自維護一份，不共用搭乘車的元件。 */
export function IconButton({
  icon,
  tone = "plain",
  size = 32,
  iconSize = 14,
  className = "",
  ...rest
}: {
  icon: string;
  tone?: Tone;
  size?: number;
  iconSize?: number;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className">) {
  return (
    <button
      type="button"
      className={`grid shrink-0 place-items-center rounded-full transition-colors ${TONE_CLASS[tone]} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <FaIcon icon={icon} size={iconSize} className="text-[#6F5FD6]" />
    </button>
  );
}

/** 同一顆圓鈕的連結版（返回鍵用）——`<a>` 不能放在 `<button>` 裡，所以分成兩個元件。 */
export function IconLink({
  icon,
  href,
  label,
  tone = "white",
  size = 32,
  iconSize = 14,
}: {
  icon: string;
  href: string;
  /** 無障礙標籤，同時也是 hover 的提示，所以要寫清楚去哪裡。 */
  label: string;
  tone?: Tone;
  size?: number;
  iconSize?: number;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-full transition-colors ${TONE_CLASS[tone]}`}
      style={{ width: size, height: size }}
    >
      <FaIcon icon={icon} size={iconSize} className="text-[#6F5FD6]" />
    </Link>
  );
}
