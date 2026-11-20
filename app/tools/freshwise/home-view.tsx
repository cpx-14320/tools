"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Callout,
  EmptyState,
  Hint,
  IconButton,
  LinkButton,
  PrimaryButton,
  SearchInput,
  SectionTitle,
  SegmentedTabs,
} from "@/components/freshwise/ui";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { ItemIcon } from "@/components/freshwise/item-icon";
import { ItemRow } from "@/components/freshwise/item-row";
import { MarketPickerModal } from "@/components/freshwise/market-picker-modal";
import { useFreshwise } from "@/components/freshwise/store";
import { copy, gradient, shadow, text } from "@/components/freshwise/theme";
import { allCodes } from "@/lib/freshwise/basket";
import { categoryImage, CATEGORIES, VENUES, venueMeta } from "@/lib/freshwise/catalog";
import { formatShortDate } from "@/lib/freshwise/dates";
import { briefReason, buildBrief } from "@/lib/freshwise/advice";
import { rowsFromBook } from "@/lib/freshwise/search";
import type { PriceBook, VenueKey } from "@/lib/freshwise/types";

const VENUE_TABS = VENUES.map((v) => ({ key: v.key, label: v.name, icon: v.icon }));

/** 首頁要列幾筆菜籃項目。再多就把下面的快報推出第一屏，使用者得捲很久才看到「今天該買
 *  什麼」——那才是這一頁的主角。想看完整菜籃的人按「看全部」。 */
const BASKET_PREVIEW = 4;

export function HomeView({ today, book }: { today: string; book: PriceBook }) {
  const router = useRouter();
  const { prefs, setVenue, setMarket, basket, basketReady, toggleBasket } = useFreshwise();
  const [keyword, setKeyword] = useState("");
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);

  const venue = venueMeta(prefs.venue);

  // 價格是伺服器端算好傳下來的（book），這裡只把它攤成清單列再挑出要顯示的幾筆。
  const rows = useMemo(() => rowsFromBook(book.quotes, today), [book.quotes, today]);
  const brief = useMemo(() => buildBrief(rows, today, book.dataDate), [rows, today, book.dataDate]);

  const basketCodes = allCodes(basket);
  // 相依陣列只能放簡單的表達式，所以先把「要顯示哪幾個品項」壓成一個字串 key——陣列
  // 每次算繪都是新的物件，直接放進相依陣列等於每次都重算。
  const previewKey = basketCodes.slice(0, BASKET_PREVIEW).join(",");
  const basketRows = useMemo(
    () => rowsFromBook(book.quotes, today, previewKey ? previewKey.split(",") : []),
    [book.quotes, today, previewKey],
  );

  function search() {
    const q = keyword.trim();
    router.push(q ? `/tools/freshwise/browse?q=${encodeURIComponent(q)}` : "/tools/freshwise/browse");
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
      {/* ── 主視覺：今天的買菜建議 ─────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[1.5rem] p-5" style={{ background: gradient.hero, boxShadow: shadow.cardStrong }}>
        <FaIcon icon="leaf" size={88} className="pointer-events-none absolute -right-3 -top-3 opacity-[0.12]" color="#fff" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white/80">
              {formatShortDate(brief.dataDate)}・{venue.name}
              {prefs.marketCode && `・${book.markets.find((m) => m.code === prefs.marketCode)?.name ?? ""}`}
            </p>
            <h1 className={`mt-1.5 text-white ${text.heroTitle}`}>{prefs.showAdvice ? brief.advice : copy.appName}</h1>
          </div>
          <Link href="/tools/freshwise/more" aria-label="設定">
            <IconButton icon="gear" tone="white" />
          </Link>
        </div>

        <div className="relative mt-4 flex items-center gap-2">
          <HeroStat icon="arrow-trend-down" label="比前一天便宜" value={`${brief.downCount} 項`} />
          <HeroStat icon="arrow-trend-up" label="比前一天貴" value={`${brief.upCount} 項`} />
        </div>
      </section>

      {/* ── 場所切換 ───────────────────────────────────────────
          放在最上面是刻意的：同一樣菜在這三種地方的價差可以到兩倍，先確定「我要去哪裡
          買」，底下所有數字才有意義。換場所會重新向伺服器取那個場所的行情。 */}
      <section className="flex flex-col gap-2">
        <SegmentedTabs items={VENUE_TABS} value={prefs.venue} onChange={(key: VenueKey) => setVenue(key)} tone="solid" scroll />
        <div className="flex items-center justify-between gap-2">
          <Hint>{venue.description}</Hint>
          <LinkButton onClick={() => setMarketPickerOpen(true)}>
            {prefs.marketCode ? (book.markets.find((m) => m.code === prefs.marketCode)?.name ?? "全部市場") : "全部市場"} ⌄
          </LinkButton>
        </div>
      </section>

      {/* 推估值與資料日期會讓上面的數字被誤讀，所以用 Callout（有底色、看得見）。 */}
      {brief.estimatedCount > 0 && (
        <Callout icon="triangle-exclamation">
          {prefs.venue === "super"
            ? copy.estimatedNote
            : `這個場所有 ${brief.estimatedCount} 項沒有實際訪價，是用批發價推估的（標著「估算」的那些）。`}
        </Callout>
      )}
      {brief.delayed && (
        <Callout icon="calendar-xmark">
          顯示的是 {formatShortDate(brief.dataDate)} 的行情。{prefs.venue === "wholesale" ? "批發市場週一休市，" : ""}資料來源還沒更新到今天。
        </Callout>
      )}

      <SearchInput value={keyword} onChange={setKeyword} onSubmit={search} placeholder="搜尋品項（高麗菜、虱目魚…）" />

      {/* ── 分類快捷 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <SectionTitle leaf>看分類行情</SectionTitle>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORIES.map((category) => (
            <Link
              key={category.key}
              href={`/tools/freshwise/browse?category=${category.key}`}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3"
              style={{ boxShadow: shadow.card }}
            >
              <ItemIcon src={categoryImage(category.key)} fallbackIcon={category.icon} alt={category.name} size={20} />
              <span className={text.meta}>{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 我的菜籃 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          leaf
          action={
            basketCodes.length > BASKET_PREVIEW ? (
              <Link href="/tools/freshwise/basket">
                <LinkButton>看全部 {basketCodes.length} 項 →</LinkButton>
              </Link>
            ) : undefined
          }
        >
          {copy.basket}今天的價格
        </SectionTitle>

        {!basketReady ? (
          <Hint center>{copy.loading}</Hint>
        ) : basketRows.length === 0 ? (
          <EmptyState
            icon="basket-shopping"
            title={basketCodes.length === 0 ? `${copy.basket}還是空的` : "菜籃裡的品項今天都沒有行情"}
            description={
              basketCodes.length === 0
                ? "把常買的菜加進菜籃，每天打開就能直接看到它們今天多少錢。"
                : "可能是產季外、或這個場所今天沒有這幾樣的資料。換個場所看看。"
            }
            action={
              <Link href="/tools/freshwise/browse">
                <PrimaryButton icon="plus">去挑常買的菜</PrimaryButton>
              </Link>
            }
          />
        ) : (
          basketRows.map((row) => (
            <ItemRow
              key={row.item.code}
              row={row}
              unit={prefs.unit}
              href={`/tools/freshwise/browse/${row.item.code}`}
              starred
              onToggleStar={() => toggleBasket(row.item.code, row.item.name)}
            />
          ))
        )}
      </section>

      {/* ── 今天最划算 ─────────────────────────────────────── */}
      {brief.cheapest.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle leaf>今天最划算</SectionTitle>
          {brief.cheapest.map((row) => (
            <ItemRow
              key={row.item.code}
              row={row}
              unit={prefs.unit}
              href={`/tools/freshwise/browse/${row.item.code}`}
              meta={briefReason(row, "cheap")}
            />
          ))}
        </section>
      )}

      {/* ── 當季 ──────────────────────────────────────────── */}
      {brief.seasonal.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle leaf>現在正當季</SectionTitle>
          {brief.seasonal.map((row) => (
            <ItemRow
              key={row.item.code}
              row={row}
              unit={prefs.unit}
              href={`/tools/freshwise/browse/${row.item.code}`}
              meta={briefReason(row, "season")}
            />
          ))}
        </section>
      )}

      {/* ── 今天漲最多 ─────────────────────────────────────── */}
      {brief.risers.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle leaf>今天漲最多，先別急著買</SectionTitle>
          {brief.risers.map((row) => (
            <ItemRow
              key={row.item.code}
              row={row}
              unit={prefs.unit}
              href={`/tools/freshwise/browse/${row.item.code}`}
              meta={briefReason(row, "rise")}
            />
          ))}
        </section>
      )}

      {brief.total === 0 && (
        <EmptyState
          icon="cloud-arrow-down"
          title="還沒有行情資料"
          description="資料來源可能暫時沒有回應，或是今天的行情還沒公布。過一會兒再重新整理看看。"
        />
      )}

      <Callout icon="database" tone="neutral">
        {copy.sourceNote}
      </Callout>

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

/** 主視覺上的小統計（圖示＋標籤＋數字）。 */
function HeroStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/15 px-3 py-2 backdrop-blur">
      <FaIcon icon={icon} size={13} className="" color="#fff" />
      <div className="min-w-0">
        <p className="text-[10px] leading-tight text-white/75">{label}</p>
        <p className="text-xs font-semibold leading-tight text-white">{value}</p>
      </div>
    </div>
  );
}
