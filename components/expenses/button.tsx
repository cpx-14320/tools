import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { activeSolid, gradient } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "dashed";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]",
  secondary: "rounded-full border border-[#ECE4FA] bg-white px-5 py-2.5 text-sm font-semibold text-[#6F5FD6] hover:bg-[#F3EFFC]",
  ghost: "rounded-full px-4 py-2 text-sm font-medium text-[#9C94C4] hover:text-[#6F5FD6]",
  dashed: "rounded-xl border border-dashed border-[#C7BFE6] px-4 py-2.5 text-sm font-medium text-[#6F5FD6]",
};

/** 記帳本共用按鈕，四種樣式比照搭乘車：primary＝漸層實心（送出/確認），
 *  secondary＝白底紫框（次要操作），ghost＝純文字（取消；要做成刪除這種警示動作時
 *  另外傳 `className="text-[#D1517E]"` 蓋色就好，不用再開一個 variant），
 *  dashed＝虛線框（新增一列這類附加動作）。 */
export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  style,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASS[variant]} ${className}`}
      style={variant === "primary" ? { background: gradient.primary, ...style } : style}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 長得像按鈕的 <Link>——Button 本身是 <button>，HTML 規則不允許把 <button> 塞進 <a> 裡，
 *  真的要連去別頁時（不是觸發動作）用這個。 */
export function ButtonLink({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors active:scale-[0.97] ${VARIANT_CLASS[variant]} ${className}`}
      style={variant === "primary" ? { background: gradient.primary } : undefined}
    >
      {children}
    </Link>
  );
}

// 圓形的圖示按鈕搬到 components/expenses/icon-button.tsx（IconButton／IconLink）：
// 那一份走 Font Awesome、而且跟搭乘車的 IconButton 同一組規格（plain/soft/white 三種
// 底色）。這裡原本那一份是吃 children 的 emoji 版，已經沒有人用。

type BadgeTone = "positive" | "negative" | "neutral";

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  positive: "bg-[#E3F6EC] text-[#2FAE82]",
  negative: "bg-[#FDEEF0] text-[#D1517E]",
  neutral: "bg-[#F3EFFC] text-[#6F5FD6]",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE_CLASS[tone]}`}>{children}</span>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** 分頁式切換（支出/收入、加項/扣項、vs上月/vs去年同月/自訂…），比照搭乘車的 pill 選單：
 *  淡紫底容器＋選中項目變白底紫字＋陰影，取代各頁面原本各自手刻的同一套按鈕。 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  fullWidth = false,
  size = "sm",
  activeTone = "white",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** 容器改用 flex＋每個選項 flex-1，選項會平均等分寬度，不是跟著文字內容走。 */
  fullWidth?: boolean;
  /** "xs" 比預設左右再收窄一點，給「要跟旁邊的東西擠在同一列」的情況用。原本還有一階
   *  "lg"（報表頁那組主分頁），但那組已經改回預設尺寸跟消費紀錄頁對齊，沒人用了就拿掉
   *  ——留著一個沒有呼叫端的尺寸，下次有人要調大小時會先猜錯該改哪裡。 */
  size?: "xs" | "sm";
  /** 選中那一格的長相。"white"＝白底紫字加陰影（預設，給擠在一列裡的小切換用，實心紫
   *  在那種尺寸下太搶眼）；"solid"＝實心紫底白字（報表頁那排主分頁，它是整頁的主要
   *  切換，要一眼看出現在在哪一頁）。兩種都走共用的 activeSolid／同一組色票。 */
  activeTone?: "white" | "solid";
}) {
  const sizeClass = size === "xs" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-1.5 text-xs";
  const activeClass = activeTone === "solid" ? activeSolid : "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]";
  return (
    <div className={`${fullWidth ? "flex" : "inline-flex"} items-center gap-0.5 rounded-full bg-[#F3EFFC] p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${fullWidth ? "flex-1" : ""} rounded-full font-medium transition-colors ${sizeClass} ${
            value === o.value ? activeClass : "text-[#9C94C4] hover:text-[#6F5FD6]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 跟 SegmentedControl（size="sm"）等高（36px）的獨立膠囊按鈕——要跟分頁切換並排在
 *  同一列時用（消費紀錄的「篩選」、比較基準、分類頁的「選取」…）。SegmentedControl 是
 *  「一定會有一個選中」的互斥切換，這個則是單獨一顆可開可關的按鈕，兩者外觀一致、
 *  高度一致，並排起來才不會一高一低。 */
export function PillButton({
  children,
  onClick,
  active = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  /** 選中／篩選生效時反白成實心紫底，一眼看得出目前是被套用的狀態。 */
  active?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "children" | "onClick" | "className">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-medium transition-colors ${
        active ? activeSolid : "bg-[#F3EFFC] text-[#9C94C4] hover:text-[#6F5FD6]"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
