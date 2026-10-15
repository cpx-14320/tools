import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { gradient } from "./theme";

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

export function IconButton({
  children,
  onClick,
  "aria-label": ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  "aria-label": string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`grid size-8 shrink-0 place-items-center rounded-full text-[#9C94C4] transition-colors hover:bg-[#F3EFFC] hover:text-[#6F5FD6] ${className}`}
    >
      {children}
    </button>
  );
}

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
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** 容器改用 flex＋每個選項 flex-1，選項會平均等分寬度，不是跟著文字內容走。 */
  fullWidth?: boolean;
  /** "lg" 用比預設寬、高一點的 padding——報表頁的支出/收入/淨額切換要比同頁的日/週/月/年明顯大一階。 */
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "px-4 py-2.5 text-sm" : "px-3.5 py-1.5 text-xs";
  return (
    <div className={`${fullWidth ? "flex" : "inline-flex"} items-center gap-0.5 rounded-full bg-[#F3EFFC] p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${fullWidth ? "flex-1" : ""} rounded-full font-medium transition-colors ${sizeClass} ${
            value === o.value ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4] hover:text-[#6F5FD6]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
