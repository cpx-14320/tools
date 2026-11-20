"use client";

import { useMemo, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { GhostButton, ListMessage, PrimaryButton, ScrollList, ScrollListRow } from "./ui";
import { FaIcon } from "./fa-icon";
import { colors, copy, text } from "./theme";
import { venueName } from "@/lib/freshwise/catalog";
import type { MarketOption, VenueKey } from "@/lib/freshwise/types";

/**
 * 市場選擇器。
 *
 * 清單是**從實際資料長出來的**（由伺服器端的 getPriceBook 一併送下來），不是寫死的——
 * 哪些市場今天真的有交易只有資料知道，寫死的清單遲早會列出一個整天沒有任何成交的市場。
 *
 * 依「分群 → 縣市」兩層分組：批發行情同時包含二十幾個蔬果批發市場與十幾個魚市場，不分開
 * 的話使用者會選了魚市場、然後發現青菜全部消失（那是正確的結果，但看起來像壞掉）。
 *
 * 第一項固定是「全部市場」：多數使用者不在意是哪一個市場，他要的是一個代表數字。
 * 這是選擇器，所以底部按鈕是「確定」而不是「儲存」（見 theme.ts 的 copy）。
 */
export function MarketPickerModal({
  open,
  venue,
  value,
  markets,
  onClose,
  onConfirm,
}: {
  open: boolean;
  venue: VenueKey;
  /** 目前選到的市場代號，空字串＝全部市場。 */
  value: string;
  markets: MarketOption[];
  onClose: () => void;
  onConfirm: (marketCode: string) => void;
}) {
  const [picked, setPicked] = useState(value);

  // 彈窗每次「打開」都要從目前真正的設定重新開始——使用者上次打開選了一半就按取消，
  // 那個沒確認的選擇不該留到下一次。用「算繪期間調整 state」處理（React 建議的做法），
  // 不是 useEffect：effect 要等算繪完才跑，中間會先閃一格舊的選擇。
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setPicked(value);
  }

  /** 分群 → 縣市 → 市場。縣市是空字串的（漁產品的回應沒有縣市欄位）歸到「其他」。 */
  const grouped = useMemo(() => {
    const byGroup = new Map<string, Map<string, MarketOption[]>>();
    for (const market of markets) {
      const cities = byGroup.get(market.group) ?? new Map<string, MarketOption[]>();
      const city = market.city || "其他";
      const list = cities.get(city) ?? [];
      list.push(market);
      cities.set(city, list);
      byGroup.set(market.group, cities);
    }
    return [...byGroup.entries()].map(([group, cities]) => ({ group, cities: [...cities.entries()] }));
  }, [markets]);

  return (
    <BottomSheetModal
      open={open}
      title={`選擇${venueName(venue)}的${copy.market}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>{copy.cancel}</GhostButton>
          <PrimaryButton onClick={() => onConfirm(picked)}>{copy.confirm}</PrimaryButton>
        </>
      }
      bodyClassName="flex flex-col gap-3 px-5 py-5"
    >
      <ScrollList className="max-h-[52vh]" divided>
        <ScrollListRow onClick={() => setPicked("")}>
          <span className="min-w-0">
            <span className={text.bodyStrong}>全部市場</span>
            <span className={`ml-2 ${text.meta}`}>
              {markets.length > 0 ? `${markets.length} 個市場的平均` : "這個場所沒有分市場"}
            </span>
          </span>
          {picked === "" && <FaIcon icon="check" size={13} color={colors.brand} />}
        </ScrollListRow>

        {markets.length === 0 && (
          <ListMessage>
            超市量販的價格是從零售價推估的，沒有個別市場可以選。
          </ListMessage>
        )}

        {grouped.map(({ group, cities }) => (
          <div key={group}>
            {/* 分群標題與縣市標題都不是可選項目，底色跟可點的列分開，避免被當成選項點。 */}
            <p className={`px-4 py-1.5 ${text.label}`} style={{ backgroundColor: colors.surfaceActive }}>
              {group}
            </p>
            {cities.map(([city, list]) => (
              <div key={city}>
                {cities.length > 1 && (
                  <p className={`px-4 py-1 ${text.meta}`} style={{ backgroundColor: colors.surfaceSoft }}>
                    {city}
                  </p>
                )}
                {list.map((market) => (
                  <ScrollListRow key={market.code} onClick={() => setPicked(market.code)}>
                    <span className={`min-w-0 truncate ${text.body}`}>{market.name}</span>
                    {picked === market.code && <FaIcon icon="check" size={13} color={colors.brand} />}
                  </ScrollListRow>
                ))}
              </div>
            ))}
          </div>
        ))}
      </ScrollList>
    </BottomSheetModal>
  );
}
