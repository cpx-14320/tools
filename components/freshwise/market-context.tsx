"use client";

import { useState } from "react";
import { useFreshwise } from "./store";
import { GameIcon } from "./game-art";
import { MarketPickerModal } from "./market-picker-modal";
import { formatShortDate } from "@/lib/freshwise/dates";
import type { PriceBook } from "@/lib/freshwise/types";

/**
 * 目前查詢的條件：市場與單位。
 *
 * **已經沒有「場所」這個選擇了。** 以前有三個（傳統市場／超市大賣場／批發市場），
 * 但對一個要去買菜的人來說那三個不是平等的選項：批發是菜販的進貨成本，他買不到；
 * 超市大賣場沒有任何公開的架上價，整個場所的數字都是推估的。留著分頁只是讓人以為
 * 那邊有別的真實資料。
 *
 * 現在一律顯示「市場常見價」＝臺中公有零售市場的實際訪價；那裡沒訪到的品項才用批發
 * 價推估，並且在那一列標「估算」。
 *
 * `showDate`：首頁不畫資料日期——那裡已經有「目前顯示的是 X 的資料」的提示條。
 */
export function MarketContext({ book, today, showDate = true }: { book: PriceBook; today: string; showDate?: boolean }) {
  const { prefs, setMarket, setPrefs } = useFreshwise();
  const [marketsOpen, setMarketsOpen] = useState(false);
  const market = book.markets.find((m) => m.code === prefs.marketCode);

  return (
    <section className="fw-market-context" aria-label="目前查詢的市場和單位">
      <div className="fw-context-strip">
        <button type="button" onClick={() => setMarketsOpen(true)} aria-label="選擇市場" className="fw-market-pick">
          <GameIcon name="market" size={36} />
          <strong>{market?.name ?? "全部市場"}</strong>
          <span className="fw-dropdown-arrow" aria-hidden="true">
            ▼
          </span>
        </button>
        <button
          className="fw-unit-leaf"
          type="button"
          onClick={() => setPrefs({ unit: prefs.unit === "catty" ? "kg" : "catty" })}
          aria-label={`切換價格單位，目前${prefs.unit === "catty" ? "台斤" : "公斤"}`}
        >
          {prefs.unit === "catty" ? "台斤" : "公斤"}
        </button>
      </div>

      {showDate && (
        <p className="fw-data-date">
          <GameIcon name="calendar" size={24} />
          資料日期 {formatShortDate(book.dataDate)}
          {book.dataDate !== today && " · 尚未更新至今日"}
        </p>
      )}

      <MarketPickerModal
        open={marketsOpen}
        venue={prefs.venue}
        value={prefs.marketCode}
        markets={book.markets}
        onClose={() => setMarketsOpen(false)}
        onConfirm={(code) => {
          setMarket(code);
          setMarketsOpen(false);
        }}
      />
    </section>
  );
}
