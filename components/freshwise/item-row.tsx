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
    // 列上**只有一種紅綠徽章**：漲跌（跟前一個交易日比）。划算度（跟近一年均價比）
    // 留在說明文字裡——兩個都做成紅綠百分比徽章的話，同一列會出現兩個看起來一樣、
    // 基準卻不同的數字，使用者沒辦法一眼分辨在講哪一件事。
    badges={<>{inSeason && <SeasonBadge/>}{quote.estimated && <EstimatedBadge/>}</>}
    meta={meta ?? defaultMeta(row)}
    price={<>
      <PriceText priceKg={quote.avgKg} rangeLowKg={quote.rangeLowKg} rangeHighKg={quote.rangeHighKg} unit={unit} size="row" showUnit={false}/>
      {/* 漲跌一律顯示，推估價也是——推估價＝批發價 × 固定係數，百分比變化把係數約掉
          之後就是批發的真實變化幅度。不可靠的是「多少錢」，不是「漲跌幾趴」。 */}
      <TrendBadge trend={trend}/>
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
  // 划算度用文字講，不做成徽章——列上那顆紅綠徽章固定是「跟昨天比」的漲跌，划算度
  // 比的是近一年的平均，兩個做成同一種樣子會被讀成同一個數字。
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
