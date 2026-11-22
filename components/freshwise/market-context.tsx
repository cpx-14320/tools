"use client";

import { useState } from "react";
import { useFreshwise } from "./store";
import { GameIcon } from "./game-art";
import { MarketPickerModal } from "./market-picker-modal";
import { SegmentedTabs } from "./ui";
import type { PriceBook, UnitKey } from "@/lib/freshwise/types";

const UNIT_TABS: readonly { key: UnitKey; label: string }[] = [
  { key: "catty", label: "台斤" },
  { key: "kg", label: "公斤" },
];

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
export function MarketContext({ book }: { book: PriceBook }) {
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
        {/* 單位用分頁而不是「按一下換另一個」的切換鈕：兩個選項都看得到，使用者不用
            先讀懂現在是哪一個、再推論按下去會變成什麼。跟排序、分類同一種互動語彙。 */}
        <SegmentedTabs items={UNIT_TABS} value={prefs.unit} onChange={(unit) => setPrefs({ unit })} />
      </div>

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
