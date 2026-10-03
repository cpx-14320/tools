import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/mock-data";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.5rem] border border-line bg-surface shadow-[0_3px_14px_-4px_rgba(42,37,80,0.12)] ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** 「這個月 vs 上個月」小標籤——花費類指標（上升=紅）請傳 goodWhenUp=false，
 *  收入類指標（上升=綠）傳 true。上個月沒資料時傳 null，這裡不渲染任何東西。 */
export function DeltaBadge({
  delta,
  pct,
  goodWhenUp,
  suffix = "vs 上月",
  className = "",
}: {
  delta: number;
  pct: number | null;
  goodWhenUp: boolean;
  suffix?: string;
  className?: string;
}) {
  const isUp = delta >= 0;
  const isGood = isUp === goodWhenUp;
  return (
    <p className={`text-xs font-medium tabular-nums ${isGood ? "text-positive" : "text-negative"} ${className}`}>
      {isUp ? "▲" : "▼"} {formatCurrency(Math.abs(delta))}
      {pct !== null && <> ({isUp ? "+" : "－"}{Math.abs(pct).toFixed(1)}%)</>} {suffix}
    </p>
  );
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

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    primary: "bg-brand text-brand-fg hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface-2",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
  };
  return (
    <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

const buttonClass = (variant: "primary" | "secondary" | "ghost", className: string) => {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97]";
  const variants: Record<string, string> = {
    primary: "bg-brand text-brand-fg hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface-2",
    ghost: "text-muted hover:text-ink hover:bg-surface-2",
  };
  return `${base} ${variants[variant]} ${className}`;
};

/** 長得像按鈕的 <Link>——Button 本身是 <button>，HTML 規則不允許把 <button> 塞進 <a> 裡，
 *  真的要連去別頁時（不是觸發動作）用這個，不要把 <Button> 包在 <Link> 裡面。 */
export function ButtonLink({
  children,
  href,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[520px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap border-b border-line bg-surface-2 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-b border-line px-4 py-3 last:border-b-0 ${className}`}>{children}</td>;
}
