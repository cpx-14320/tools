"use client";

import { useMemo, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { GhostButton, Hint, ListMessage, PrimaryButton, SearchInput, ScrollList, ScrollListRow, SegmentedTabs } from "./ui";
import { FaIcon } from "./fa-icon";
import { ItemIcon } from "./item-icon";
import { SeasonBadge } from "./badges";
import { colors, copy, text } from "./theme";
import { CATEGORIES, categoryName, isInSeason, itemImage, TRACKED_CATALOG } from "@/lib/freshwise/catalog";
import { matchesKeyword } from "@/lib/freshwise/search";
import type { CategoryKey } from "@/lib/freshwise/types";

type TabKey = CategoryKey | "all";

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  ...CATEGORIES.map((c) => ({ key: c.key as TabKey, label: c.name })),
];

/**
 * 品項選擇器（加入菜籃用）。搜尋＋分類分頁＋清單，**可以一次勾好幾樣再一起加入**。
 *
 * 本來是「點一個就加入並關閉」，但實際用起來要加五樣菜就得開關彈窗五次，每次還要重新
 * 搜尋、重新切分類。改成多選＋底部「加入 N 項」。
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
  /** 一次回傳選好的所有代碼。 */
  onPick: (codes: string[]) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [picked, setPicked] = useState<string[]>([]);

  // 每次打開都清掉上一次的搜尋條件（理由同 MarketPickerModal）。
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setKeyword("");
      setTab("all");
      setPicked([]);
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
    <BottomSheetModal
      open={open}
      title="選擇品項"
      onClose={onClose}
      bodyClassName="flex flex-col gap-3 px-5 py-5"
      footer={
        <>
          <GhostButton onClick={onClose}>{copy.cancel}</GhostButton>
          <PrimaryButton disabled={picked.length === 0} onClick={() => onPick(picked)}>
            {picked.length > 0 ? `加入 ${picked.length} 項` : "加入"}
          </PrimaryButton>
        </>
      }
    >
      <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋品項（高麗菜、虱目魚…）" />
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} scroll />

      <ScrollList className="max-h-[48vh]" divided>
        {results.length === 0 && <ListMessage>找不到「{keyword}」，換個說法試試</ListMessage>}
        {results.map((item) => {
          const already = excluded.has(item.code);
          const chosen = picked.includes(item.code);
          return (
            <ScrollListRow
              key={item.code}
              onClick={already ? undefined : () => setPicked((cur) => (cur.includes(item.code) ? cur.filter((c) => c !== item.code) : [...cur, item.code]))}
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
              {already ? <Hint>已加入</Hint> : <FaIcon icon={chosen ? "check" : "plus"} size={13} color={chosen ? colors.brand : colors.placeholder} />}
            </ScrollListRow>
          );
        })}
      </ScrollList>
    </BottomSheetModal>
  );
}
