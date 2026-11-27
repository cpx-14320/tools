"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** 行情、菜籃與詳情比價共用的紙上列：插畫／名稱與來源／價格／可選操作。 */
export function PriceListRow({
  art, title, badges, meta, price, leading, trailing, href, onClick,
}: {
  art?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  /** 沒有值就不畫那一行——空的 meta 會留下一道空白，看起來像載入失敗。 */
  meta?: ReactNode;
  price: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const content = <>
    {art}
    <div className="fw-item-copy min-w-0 flex-1">
      <div className="fw-item-name flex items-center gap-1.5">
        <span className="fw-item-title">{title}</span>
        {badges}
      </div>
      {meta ? <div className="fw-item-meta mt-0.5 text-xs text-[#836A54]">{meta}</div> : null}
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">{price}</div>
  </>;
  return <div className="fw-item-row">
    {leading}
    {href ? <Link href={href} className="fw-item-link">{content}</Link>
      : onClick ? <button type="button" onClick={onClick} className="fw-item-link text-left">{content}</button>
      : <div className="fw-item-link">{content}</div>}
    {trailing}
  </div>;
}
