"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ItemIcon } from "./item-icon";
import { PriceText } from "./price-text";
import { EstimatedBadge, SeasonBadge, TrendBadge, ValueBadge } from "./badges";
import { text } from "./theme";
import { GameIcon } from "./game-art";
import { itemImage } from "@/lib/freshwise/catalog";
import { historyLabel } from "@/lib/freshwise/price";
import type { PriceRow } from "@/lib/freshwise/search";
import type { UnitKey } from "@/lib/freshwise/types";

/**
 * 品項的一列。首頁快報、行情清單、我的菜籃三個地方都是這一個元件——這是整個工具最常
 * 出現的版面單位，三處各寫一份的話「價格放右邊、漲跌徽章放價格下面、當季徽章跟在品名
 * 後面」這些排版細節一定會長出三種版本。
 *
 * 版面固定是四段：左邊圖示格 → 品名與徽章 → 說明文字 → 右邊價格與漲跌。可選的拖曳握把
 * 插在最左邊（我的菜籃），可選的星星在最右邊（行情清單）。
 */
export function ItemRow({
  row,
  unit,
  href,
  onClick,
  meta,
  leading,
  starred,
  onToggleStar,
}: {
  row: PriceRow;
  unit: UnitKey;
  /** 有給就整列可以點進詳情頁。 */
  href?: string;
  /** 不用 href 時的點擊行為（我的菜籃點一列是開編輯彈窗，不是換頁）。 */
  onClick?: () => void;
  /** 覆蓋預設的說明文字（預設會依划算度／當季自動產生）。 */
  meta?: ReactNode;
  /** 最左邊的插槽，給拖曳握把用。 */
  leading?: ReactNode;
  /** undefined＝不顯示星星。 */
  starred?: boolean;
  onToggleStar?: () => void;
}) {
  const { item, quote, trend, value, inSeason, reliable } = row;

  const content = (
    <>
      {/* 圖片還沒放進 public/freshwise/items/ 之前，會自動顯示 Font Awesome 的向量圖示。 */}
      <ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={20} boxSize={40} />

      <div className="fw-item-copy min-w-0 flex-1">
        <div className="fw-item-name flex items-center gap-1.5">
          <span className="fw-item-title">{item.name}</span>
          {inSeason && <SeasonBadge />}
          {quote.estimated && <EstimatedBadge />}
        </div>
        {/* 說明文字：呼叫端沒指定時自動產生。不要留空——空的那一行會讓每一列高度不一樣，
            清單看起來像壞掉。 */}
        <div className={`fw-item-meta mt-0.5 ${text.meta}`}>{meta ?? defaultMeta(row)}</div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <PriceText
          priceKg={quote.avgKg}
          rangeLowKg={quote.rangeLowKg}
          rangeHighKg={quote.rangeHighKg}
          unit={unit}
          size="row"
          showUnit={false}
        />
        {/* 推估的品項不顯示漲跌與划算度：那是把批發的變化乘上一個倍數得到的，講的其實是
            批發的漲跌，標在「傳統市場」那一列會誤導。 */}
        {!quote.estimated && <TrendBadge trend={trend} />}
        {/* 漲跌持平時 TrendBadge 不畫任何東西，這時候補一個划算度徽章，右欄才不會空一塊。
            歷史不夠長的品項判不出划算度（見 price.ts 的 MIN_HISTORY_DAYS），就什麼都不放。 */}
        {!quote.estimated && trend.direction === "flat" && reliable && <ValueBadge value={value} />}
      </div>
    </>
  );

  return (
    // 清單列不是一張卡片，是「紙上的一行」：沒有底色、沒有陰影，只用一條虛線跟下一行
    // 分開（最後一行的線由 .fw-item-row:last-child 收掉）。以前元件畫成白卡片、CSS 再用
    // !important 把底色跟陰影清掉，兩邊互相抵銷。
    <div className="fw-item-row">
      {leading}
      {href ? (
        <Link href={href} className="fw-item-link">
          {content}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className="fw-item-link text-left">
          {content}
        </button>
      ) : (
        <div className="fw-item-link">{content}</div>
      )}
      {starred !== undefined && (
        <button
          type="button"
          onClick={onToggleStar}
          aria-label={starred ? `將${item.name}從菜籃移除` : `把${item.name}加入菜籃`}
          className="fw-item-toggle"
          aria-pressed={starred}
        >
          {/* 實心星＝已在菜籃、空心星＝還沒加。只用顏色區分的話（都是實心星，一個綠一個
              灰）在淺色底上很難一眼分辨，也對色弱使用者不友善，所以連形狀一起換。 */}
          <GameIcon name={starred ? "basket" : "seed"} size={32} />
          <small aria-hidden="true">{starred ? "✓" : "+"}</small>
        </button>
      )}
    </div>
  );
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
  if (row.reliable) {
    const abs = Math.abs(row.value.percent);
    const base = historyLabel(row.quote.historyDays);
    if (row.value.level === "cheap") return `比${base}的平均便宜 ${abs}%`;
    if (row.value.level === "pricey") return `比${base}的平均貴 ${abs}%`;
  }
  if (row.inSeason) return "當季盛產，品質通常比較好";
  if (!row.reliable) return `歷史資料累積中（已有 ${row.quote.historyDays} 天）`;
  return `跟${historyLabel(row.quote.historyDays)}的平均差不多`;
}
