"use client";

import { formatPriceIn, unitLabel } from "@/lib/freshwise/price";
import type { UnitKey } from "@/lib/freshwise/types";
import { text } from "./theme";

/**
 * 價格數字＋單位。整個工具只有這一個地方把「元/公斤的資料」變成「畫面上的數字」，
 * 所以單位換算不可能有某一頁漏換（這是這個工具最容易出的錯：資料層全部是元/公斤，
 * 台灣人看的是元/台斤，少換一次就是整頁的數字錯了 1.67 倍，而且看起來都還很合理）。
 *
 * 三種尺寸對應 theme.ts 的字級階層：
 * - `big`：詳情頁的今日價（28px）。
 * - `row`：清單每一列的價格（17px）。
 * - `inline`：夾在句子裡的價格，跟內文同一個大小。
 */
export function PriceText({
  priceKg,
  rangeLowKg,
  rangeHighKg,
  unit,
  size = "row",
  showUnit = true,
}: {
  /** 元/公斤的原始價格。換算成顯示單位是這個元件的工作，不要在呼叫端先換。 */
  priceKg: number;
  /**
   * 推估價格的區間。兩個都給的時候**顯示的是區間而不是單一數字**——推估值用一個精確
   * 的數字呈現會讓人以為那是量過的。實測回推發現「零售 ÷ 批發」在 1.2～4.5 倍之間，
   * 單一係數套出來的數字可以錯到讓人買錯，所以沒有實測價的場所一律給區間。
   */
  rangeLowKg?: number;
  rangeHighKg?: number;
  unit: UnitKey;
  size?: "big" | "row" | "inline";
  showUnit?: boolean;
}) {
  const sizeCls = size === "big" ? text.priceBig : size === "row" ? text.priceRow : text.bodyStrong;
  const isRange = rangeLowKg !== undefined && rangeHighKg !== undefined && rangeHighKg > rangeLowKg;

  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      {isRange ? (
        // 區間用「～」連接。字級比單一數字小一階（區間一定比較長，用同一階會擠爆
        // 清單那一列的右欄）。
        <span className={size === "big" ? text.priceRow : text.bodyStrong}>
          {formatPriceIn(rangeLowKg as number, unit)}～{formatPriceIn(rangeHighKg as number, unit)}
        </span>
      ) : (
        <span className={sizeCls}>{formatPriceIn(priceKg, unit)}</span>
      )}
      {showUnit && <span className={text.meta}>{unitLabel(unit)}</span>}
    </span>
  );
}

/** 「48～72 元/台斤」這種區間（詳情頁的上價／下價、近一年最高最低）。 */
export function PriceRange({ lowKg, highKg, unit }: { lowKg: number; highKg: number; unit: UnitKey }) {
  return (
    <span className={`whitespace-nowrap ${text.body}`}>
      {formatPriceIn(lowKg, unit)}～{formatPriceIn(highKg, unit)}
      <span className={`ml-1 ${text.meta}`}>{unitLabel(unit)}</span>
    </span>
  );
}
