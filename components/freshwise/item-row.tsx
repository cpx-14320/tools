"use client";

import type { ReactNode } from "react";
import { ItemIcon } from "./item-icon";
import { PriceText } from "./price-text";
import { PriceListRow } from "./price-list-row";
import { EstimatedBadge, SeasonBadge, TrendBadge } from "./badges";
import { GameIcon } from "./game-art";
import { itemImage } from "@/lib/freshwise/catalog";
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
 * 預設的說明文字。
 *
 * **划算度不在這裡講。** 原本每一列底下都有一句「比近一年的平均便宜 12%」，但列上已經
 * 有一顆「▼ 30%」的漲跌徽章——兩個百分比上下疊在一起，基準卻一個是昨天、一個是近一年，
 * 使用者會把它們讀成同一件事（或是互相矛盾：跌了 30% 卻說「比平常貴」）。划算度留在
 * 詳情頁講，那裡有空間把基準寫清楚（見 price.ts 的 valueSentence）。
 *
 * 剩下的三種情況還是要講，因為它們解釋的是「這個數字能不能信」：
 *   - 推估價 → 說明那是範圍不是實測
 *   - 歷史不夠長 → 講清楚原因，不然使用者會以為壞了
 *   - 當季 → 這是「要不要買」的提示，跟價格基準無關
 *
 * 都不適用時回 `undefined`，列上就不畫那一行（見 PriceListRow）。
 */
function defaultMeta(row: PriceRow): string | undefined {
  if (row.quote.estimated && row.quote.rangeLowKg !== undefined) {
    return `沒有實測價，依批發價推估的範圍`;
  }
  if (!row.reliable) return `歷史資料累積中（已有 ${row.quote.historyDays} 天）`;
  if (row.inSeason) return "當季盛產";
  return undefined;
}
