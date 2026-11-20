"use client";

import { useMemo, useState } from "react";
import { Callout, EmptyState, GhostButton, Hint, LinkButton, PageTitle, SearchInput, SegmentedTabs } from "@/components/freshwise/ui";
import { ItemRow } from "@/components/freshwise/item-row";
import { GoTopButton } from "@/components/freshwise/go-top-button";
import { MarketPickerModal } from "@/components/freshwise/market-picker-modal";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, text } from "@/components/freshwise/theme";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { isInBasket } from "@/lib/freshwise/basket";
import { CATEGORIES, VENUES, venueMeta } from "@/lib/freshwise/catalog";
import { formatShortDate } from "@/lib/freshwise/dates";
import { filterRows, rowsFromBook, sortRows, SORT_OPTIONS, type SortKey } from "@/lib/freshwise/search";
import { unitLabel } from "@/lib/freshwise/price";
import type { CategoryKey, PriceBook, VenueKey } from "@/lib/freshwise/types";

const VENUE_TABS = VENUES.map((v) => ({ key: v.key, label: v.name, icon: v.icon }));
const CATEGORY_TABS: readonly { key: CategoryKey | ""; label: string }[] = [
  { key: "", label: "全部" },
  ...CATEGORIES.map((c) => ({ key: c.key as CategoryKey | "", label: c.name })),
];

/** 清單超過這個長度才顯示「回到頂部」。短清單按鈕只是多一個擋住內容的圓圈。 */
const GO_TOP_THRESHOLD = 8;

export function BrowseView({
  today,
  book,
  initialKeyword,
  initialCategory,
}: {
  today: string;
  book: PriceBook;
  initialKeyword: string;
  initialCategory: CategoryKey | "";
}) {
  const { prefs, setVenue, setMarket, basket, toggleBasket } = useFreshwise();

  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState<CategoryKey | "">(initialCategory);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [inSeasonOnly, setInSeasonOnly] = useState(false);
  const [cheapOnly, setCheapOnly] = useState(false);
  const [measuredOnly, setMeasuredOnly] = useState(false);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);

  const venue = venueMeta(prefs.venue);

  // 價格是伺服器端算好的，這裡只做攤平、篩選與排序——打字搜尋不會重新向伺服器要資料。
  const allRows = useMemo(() => rowsFromBook(book.quotes, today), [book.quotes, today]);
  const rows = useMemo(
    () => sortRows(filterRows(allRows, { category, keyword, inSeasonOnly, cheapOnly, measuredOnly }), sort),
    [allRows, category, keyword, inSeasonOnly, cheapOnly, measuredOnly, sort],
  );

  const filtering = inSeasonOnly || cheapOnly || measuredOnly || !!keyword.trim() || !!category;
  const estimatedCount = allRows.filter((row) => row.quote.estimated).length;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <PageTitle>行情</PageTitle>

      <SegmentedTabs items={VENUE_TABS} value={prefs.venue} onChange={(key: VenueKey) => setVenue(key)} tone="solid" scroll />

      <div className="flex items-center justify-between gap-2">
        <Hint>
          {formatShortDate(book.dataDate)}・{venue.name}・{unitLabel(prefs.unit)}
        </Hint>
        <LinkButton onClick={() => setMarketPickerOpen(true)}>
          {prefs.marketCode ? (book.markets.find((m) => m.code === prefs.marketCode)?.name ?? "全部市場") : "全部市場"} ⌄
        </LinkButton>
      </div>

      {prefs.venue === "super" && <Callout icon="triangle-exclamation">{copy.estimatedNote}</Callout>}
      {prefs.venue === "market" && estimatedCount > 0 && (
        <Callout icon="triangle-exclamation">{copy.retailCoverageNote}</Callout>
      )}

      <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋品項（高麗菜、虱目魚…）" />

      <SegmentedTabs items={CATEGORY_TABS} value={category} onChange={setCategory} scroll />

      {/* 排序與篩選開關。排序用分頁、篩選用可開關的膠囊——兩者的差別是「排序永遠只有一個
          生效、篩選可以同時生效」，形狀不同使用者才不會誤以為篩選也是互斥的。 */}
      <div className="flex flex-col gap-2">
        <SegmentedTabs items={SORT_OPTIONS} value={sort} onChange={setSort} scroll />
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <FilterPill icon="leaf" label="只看當季" active={inSeasonOnly} onClick={() => setInSeasonOnly((v) => !v)} />
          <FilterPill icon="tag" label="只看划算" active={cheapOnly} onClick={() => setCheapOnly((v) => !v)} />
          {/* 「只看實際訪價」是這個工具特有的篩選：使用者如果不想看推估值，應該有辦法
              把它們藏起來，而不是只能自己認那個「估算」徽章。 */}
          <FilterPill icon="clipboard-check" label="只看實際訪價" active={measuredOnly} onClick={() => setMeasuredOnly((v) => !v)} />
          {filtering && (
            <GhostButton
              className="ml-auto shrink-0 !px-2 !text-xs"
              onClick={() => {
                setKeyword("");
                setCategory("");
                setInSeasonOnly(false);
                setCheapOnly(false);
                setMeasuredOnly(false);
              }}
            >
              清除條件
            </GhostButton>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Hint>
          共 {rows.length} 項{filtering && allRows.length !== rows.length ? `（全部 ${allRows.length} 項）` : ""}
        </Hint>
        {/* 星星的意思要寫出來一次。只放一顆圖示的話，使用者得自己猜那是收藏、評分還是
            「推薦」。 */}
        <Hint>按 ☆ 加進{copy.basket}</Hint>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <EmptyState
            icon="magnifying-glass"
            title={allRows.length === 0 ? "這個場所今天還沒有行情" : "沒有符合條件的品項"}
            description={
              allRows.length === 0
                ? "資料來源可能還沒更新，或這個市場今天沒有交易。換個場所或市場看看。"
                : keyword.trim()
                  ? `找不到「${keyword.trim()}」，換個說法或清掉其他條件試試。`
                  : "把篩選條件放寬一點試試。"
            }
          />
        ) : (
          rows.map((row) => (
            <ItemRow
              key={row.item.code}
              row={row}
              unit={prefs.unit}
              href={`/tools/freshwise/browse/${row.item.code}`}
              starred={isInBasket(basket, row.item.code)}
              onToggleStar={() => toggleBasket(row.item.code, row.item.name)}
            />
          ))
        )}
      </div>

      <GoTopButton visible={rows.length >= GO_TOP_THRESHOLD} />

      <MarketPickerModal
        open={marketPickerOpen}
        venue={prefs.venue}
        value={prefs.marketCode}
        markets={book.markets}
        onClose={() => setMarketPickerOpen(false)}
        onConfirm={(marketCode) => {
          setMarket(marketCode);
          setMarketPickerOpen(false);
        }}
      />
    </div>
  );
}

/** 可開關的篩選膠囊。選中是品牌綠填滿，沒選中是淡綠底——跟 SegmentedTabs 的選中態長得
 *  不一樣，使用者才分得出「這是開關」不是「這是分頁」。 */
function FilterPill({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 ${text.badge}`}
      style={{ backgroundColor: active ? colors.brand : colors.surfaceSoft, color: active ? "#fff" : colors.muted }}
    >
      <FaIcon icon={icon} size={11} className="" color={active ? "#fff" : colors.faint} />
      {label}
    </button>
  );
}
