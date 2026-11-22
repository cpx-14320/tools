"use client";

import type { ReactNode } from "react";
import { ItemIcon } from "./item-icon";
import { PriceText } from "./price-text";
import { PriceListRow } from "./price-list-row";
import { EstimatedBadge, SeasonBadge, TrendBadge } from "./badges";
import { GameIcon } from "./game-art";
import { itemImage } from "@/lib/freshwise/catalog";
import { historyLabel } from "@/lib/freshwise/price";
import type { PriceRow } from "@/lib/freshwise/search";
import type { UnitKey } from "@/lib/freshwise/types";

/** 品項資料與菜籃操作保留在這裡；列排版與詳情比價共用 PriceListRow。 */
export function ItemRow({ row, unit, href, onClick, meta, leading, starred, onToggleStar }: {
  row: PriceRow;
  unit: UnitKey;
  href?: string;
  onClick?: () => void;
  meta?: ReactNode;
  leading?: ReactNode;
  starred?: boolean;
  onToggleStar?: () => void;
}) {
  const { item, quote, trend, inSeason } = row;
  return <PriceListRow
    art={<ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={20} boxSize={40}/>}
    title={item.name}
    badges={<>{inSeason && <SeasonBadge/>}{quote.estimated && <EstimatedBadge/>}</>}
    meta={meta ?? defaultMeta(row)}
    price={<>
      <PriceText priceKg={quote.avgKg} rangeLowKg={quote.rangeLowKg} rangeHighKg={quote.rangeHighKg} unit={unit} size="row" showUnit={false}/>
      {/* 推估價不顯示批發漲跌；歷史足夠且持平時才顯示划算度。 */}
      {!quote.estimated && <TrendBadge trend={trend}/>}
    </>}
    leading={leading}
    href={href}
    onClick={onClick}
    trailing={starred !== undefined && <button type="button" onClick={onToggleStar} aria-label={starred ? `將${item.name}從菜籃移除` : `把${item.name}加入菜籃`} className="fw-item-toggle" aria-pressed={starred}>
      <GameIcon name={starred ? "basket" : "seed"} size={32}/>
      <small aria-hidden="true">{starred ? "✓" : "+"}</small>
    </button>}
  />;
}

/**
 * 預設的說明文字。優先順序：特別划算／特別貴 → 當季 → 歷史還在累積 → 跟平常差不多。
 *
 * 歷史不夠長時刻意講「歷史資料累積中」而不是沉默：使用者看到別的列都有「比平常便宜
 * 12%」、這一列什麼都沒有，會以為是壞了。講清楚原因比留白好。
 */
function defaultMeta(row: PriceRow): string {
  // 推估的品項先講「這是推估的範圍」——它沒有實測價，講划算度沒有意義（區間的中點
  // 跟它自己的歷史比，比出來的是倍數的變化不是行情的變化）。
  if (row.quote.estimated && row.quote.rangeLowKg !== undefined) {
    return `沒有實測價，依批發價推估的範圍`;
  }
  // 有數字就只給數字。以前同一列會同時出現「比平常便宜 13%」這句話跟一個「划算」
  // 徽章，兩個在講同一件事；形容詞留給沒有數字可講的情況。
  if (row.reliable) {
    const abs = Math.abs(row.value.percent);
    const base = historyLabel(row.quote.historyDays);
    if (row.value.level === "cheap") return `比${base}的平均便宜 ${abs}%`;
    if (row.value.level === "pricey") return `比${base}的平均貴 ${abs}%`;
    return `跟${base}的平均差不多`;
  }
  if (row.inSeason) return "當季盛產";
  return `歷史資料累積中（已有 ${row.quote.historyDays} 天）`;
}
