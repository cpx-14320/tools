"use client";

import { useMemo, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { Hint, ListMessage, SearchInput, ScrollList, ScrollListRow, SegmentedTabs } from "./ui";
import { FaIcon } from "./fa-icon";
import { ItemIcon } from "./item-icon";
import { SeasonBadge } from "./badges";
import { colors, text } from "./theme";
import { CATEGORIES, categoryName, isInSeason, itemImage, TRACKED_CATALOG } from "@/lib/freshwise/catalog";
import { matchesKeyword } from "@/lib/freshwise/search";
import type { CategoryKey } from "@/lib/freshwise/types";

type TabKey = CategoryKey | "all";

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  ...CATEGORIES.map((c) => ({ key: c.key as TabKey, label: c.name })),
];

/**
 * 品項選擇器（加入菜籃用）。搜尋＋分類分頁＋清單，點一個就直接加入並關閉——不需要再按
 * 一次「確定」，因為這個彈窗只選一個東西，點擊本身就是確認。
 *
 * 這裡刻意不顯示價格：使用者在這一步決定的是「我要追蹤什麼」，不是在比價。塞上價格會
 * 讓每一列變高、一屏能看到的品項變少，反而更難找到想要的那一樣。
 *
 * 已經在這個分類裡的品項仍然列出來、但標成「已加入」且不可點——整個藏起來的話，使用者
 * 會以為清單裡沒有這樣菜（「怎麼找不到高麗菜？」），而不是「它已經在裡面了」。
 */
export function ItemPickerModal({
  open,
  month,
  excludeCodes,
  onClose,
  onPick,
}: {
  open: boolean;
  /** 用來標當季。由呼叫端從「今天」算好傳進來，不要在這裡 new Date()。 */
  month: number;
  /** 已經在目標分類裡的品項代碼。 */
  excludeCodes: string[];
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<TabKey>("all");

  // 每次打開都清掉上一次的搜尋條件（理由同 MarketPickerModal）。
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setKeyword("");
      setTab("all");
    }
  }

  const excluded = useMemo(() => new Set(excludeCodes), [excludeCodes]);

  const results = useMemo(
    () =>
      TRACKED_CATALOG.filter((item) => (tab === "all" || item.category === tab) && matchesKeyword(item, keyword)).sort((a, b) => {
        // 當季的排前面，其次照目錄原本的順序（目錄本身是按類別與常見程度排的）。
        const aSeason = isInSeason(a, month) ? 0 : 1;
        const bSeason = isInSeason(b, month) ? 0 : 1;
        return aSeason - bSeason;
      }),
    [tab, keyword, month],
  );

  return (
    <BottomSheetModal open={open} title="選擇品項" onClose={onClose} bodyClassName="flex flex-col gap-3 px-5 py-5">
      <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋品項（高麗菜、虱目魚…）" />
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} scroll />

      <ScrollList className="max-h-[48vh]" divided>
        {results.length === 0 && <ListMessage>找不到「{keyword}」，換個說法試試</ListMessage>}
        {results.map((item) => {
          const already = excluded.has(item.code);
          return (
            <ScrollListRow
              key={item.code}
              onClick={already ? undefined : () => onPick(item.code)}
              className={already ? "opacity-50" : ""}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={16} boxSize={32} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className={`truncate ${text.bodyStrong}`}>{item.name}</span>
                    {isInSeason(item, month) && <SeasonBadge />}
                  </span>
                  {/* 別名寫在第二行：使用者搜「高麗菜」命中的是「甘藍」，不告訴他這兩個
                      是同一樣東西，他會以為搜錯了。 */}
                  <span className={`block truncate ${text.meta}`}>
                    {categoryName(item.category)}
                    {item.aliases.length > 0 && `・又叫 ${item.aliases.join("、")}`}
                  </span>
                </span>
              </span>
              {already ? <Hint>已加入</Hint> : <FaIcon icon="plus" size={12} color={colors.brand} />}
            </ScrollListRow>
          );
        })}
      </ScrollList>
    </BottomSheetModal>
  );
}
