import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/** 入口頁、登入、註冊、管理後台、無權限畫面共用的一小套元件。
 *
 *  色票走 globals.css 的共用 tokens（--brand／--ink／--muted／--line…），那組值本來就是
 *  照記帳本 components/expenses/theme.ts 對齊過的，所以這裡只要把「形狀」也對齊（圓角
 *  2xl、淡紫陰影、膠囊按鈕、漸層主按鈕），這幾頁看起來就跟記帳本是同一個 App。
 *
 *  記帳本／搭乘車各自有自己的元件庫，刻意不 import 這裡的東西，反之亦然。 */

/** Font Awesome 圖示的薄包裝（字型本身在 app/layout.tsx 全站 import）。
 *
 *  這幾頁的圖示一律走這個，不要再用表情符號當圖示：表情符號的長相由作業系統字型決定，
 *  大小、基線對不準旁邊的文字，跟工具自己的插畫（public/hub/*.png）也不是同一種畫風。
 *  記帳本、搭乘車各有一份同名元件，三邊刻意各自維護（模組邊界，見 brand-mark.tsx）。 */
export function FaIcon({ icon, size = 14, className = "" }: { icon: string; size?: number; className?: string }) {
  return <i aria-hidden="true" className={`fa-solid fa-${icon} ${className}`} style={{ fontSize: size, lineHeight: 1 }} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)] ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

/** 一區清單上方那行小標題（「小工具」「帳號」…）。比照記帳本設定頁的分區排法：
 *  小標題 ＋ 一張把同類項目裝在一起的卡片，不要讓所有項目擠成一長條。 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 px-1 text-xs font-medium text-muted">{children}</p>;
}

/** 清單卡片外框——列與列之間一條淡淡的分隔線，整組只有外面一圈圓角。 */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)] ${className}`}
    >
      {children}
    </div>
  );
}

/** 清單裡的一列：左邊圖示、中間標題／說明、右邊附註，可選的「›」。
 *
 *  `href` ＝ 整列是連結、`onClick` ＝ 整列是按鈕、兩個都不給 ＝ 純展示。整列可點（不是只有
 *  右邊一顆小按鈕）是手機上最好按的形狀，比照記帳本的 ListRow。 */
export function ListRow({
  icon,
  title,
  desc,
  right,
  chevron = false,
  href,
  onClick,
  disabled = false,
  className = "",
}: {
  /** 圖示本體（<IconTile>、工具插畫的 <img>…），尺寸由呼叫端決定，這裡只負責不被壓縮。 */
  icon?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  /** 右邊的附註：狀態膠囊、件數、刪除鍵… */
  right?: ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  /** 只對 onClick 那種列有意義（連結沒有 disabled 這回事）。 */
  disabled?: boolean;
  className?: string;
}) {
  const base = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${className}`;
  const content = (
    <>
      {icon !== undefined && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {desc && <span className="mt-0.5 block text-xs leading-snug text-muted">{desc}</span>}
      </span>
      {right !== undefined && <span className="shrink-0">{right}</span>}
      {chevron && (
        <span aria-hidden className="shrink-0 text-[#C7BFE6]">
          ›
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${base} active:bg-surface-2`}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={`${base} active:bg-surface-2 disabled:opacity-50`}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}

/** 清單列左邊那塊 40px 的圖示底——跟記帳本 IconAvatar 同尺寸，所以兩邊的清單並排看
 *  起來是同一套。tone 只有「品牌紫」跟「警示紅」兩種，警示紅給刪除、鎖定這類列用。 */
export function IconTile({ icon, tone = "brand" }: { icon: string; tone?: "brand" | "negative" }) {
  const toneCls = tone === "negative" ? "bg-negative-soft text-negative" : "bg-brand-soft text-brand";
  return <span className={`grid size-10 place-items-center rounded-xl ${toneCls}`}>{<FaIcon icon={icon} size={16} />}</span>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "brand" | "future";
}) {
  const toneCls: Record<string, string> = {
    neutral: "bg-surface-2 text-muted",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    brand: "bg-brand-soft text-brand",
    future: "border border-dashed border-line text-muted",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneCls[tone]}`}>
      {children}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost";

/** 三種樣式比照記帳本的 Button：primary＝漸層實心（送出／主要動作）、secondary＝白底
 *  紫框（次要動作）、ghost＝純文字。刪除這種警示動作用 secondary ＋ `text-negative`
 *  蓋字色，不要另開一個 variant。 */
const VARIANT_CLASS: Record<Variant, string> = {
  primary: "rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]",
  secondary: "rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-brand hover:bg-surface-2",
  ghost: "rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink hover:bg-surface-2",
};

const PRIMARY_BG = "linear-gradient(90deg, #8A7CEE, #6F5FD6)";

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
      style={variant === "primary" ? { background: PRIMARY_BG, ...style } : style}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 長得像按鈕的 <Link>——Button 本身是 <button>，HTML 不允許把 <button> 塞進 <a> 裡，
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
      style={variant === "primary" ? { background: PRIMARY_BG } : undefined}
    >
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`flex flex-wrap justify-between gap-3 ${description ? "items-start" : "items-center"}`}>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

// Stat／DeltaBadge／TableWrap／Th／Td 已移除：管理後台原本那張 min-w-[520px] 的使用者
// 表格改成一人一張卡（430px 的框裡放表格只能橫向捲），其餘三個從來沒有呼叫端。
// 留著沒人用的元件，下次有人要改版面時會先去改錯的地方。
