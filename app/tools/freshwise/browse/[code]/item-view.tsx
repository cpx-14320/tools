"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompanion } from "@/components/freshwise/companion-store";
import { IllustratedArt } from "@/components/freshwise/game-art";
import { QuestSlip } from "@/components/freshwise/companion-widgets";
import Link from "next/link";
import {
  Callout,
  CollapsibleList,
  Paper,
  EmptyState,
  Hint,
  LinkButton,
  ListCard,
  Note,
  PrimaryButton,
  SectionTitle,
  SegmentedTabs,
} from "@/components/freshwise/ui";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { ItemIcon } from "@/components/freshwise/item-icon";
import { PriceListRow } from "@/components/freshwise/price-list-row";
import { EstimatedBadge, SeasonBadge, TrendBadge, ValueBadge } from "@/components/freshwise/badges";
import { PriceText } from "@/components/freshwise/price-text";
import { PriceChart } from "@/components/freshwise/price-chart";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, shadow, text } from "@/components/freshwise/theme";
import { isInBasket } from "@/lib/freshwise/basket";
import { categoryName, itemImage, itemOrPlaceholder } from "@/lib/freshwise/catalog";
import { formatShortDate, monthOf } from "@/lib/freshwise/dates";
import {
  formatPriceIn,
  hasReliableHistory,
  historyLabel,
  MIN_HISTORY_DAYS,
  statsOf,
  trendOf,
  unitLabel,
  unitShort,
  valueOf,
  valueSentence,
} from "@/lib/freshwise/price";
import type { ItemDetail, UnitKey } from "@/lib/freshwise/types";

/** 走勢圖的期間選項。 */
const RANGES: readonly { key: string; label: string; days: number }[] = [
  { key: "7", label: "7 天", days: 7 },
  { key: "30", label: "30 天", days: 30 },
  { key: "90", label: "3 個月", days: 90 },
  { key: "365", label: "1 年", days: 365 },
];

const MONTH_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];


export function ItemView({ code, today, detail }: { code: string; today: string; detail: ItemDetail | null }) {
  const { prefs, basket, toggleBasket, setPrefs } = useFreshwise();
  const { record } = useCompanion();
  useEffect(() => { if (detail) record({ type: "view", code }); }, [code, detail, record]);
  const [rangeKey, setRangeKey] = useState("30");
  // 完整行情表預設收起來：五欄數字對「不懂買菜價格的人」是雜訊，但要自己判讀的人一定
  // 要看得到，所以給一個切換而不是二選一。
  const [showFullTable, setShowFullTable] = useState(false);

  const item = itemOrPlaceholder(code);
  const month = monthOf(today);
  const inSeason = item.season.includes(month);
  const starred = isInBasket(basket, code);

  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
  // 歷史只有幾天的品項（批發行情還在累積）切到「1 年」會跟「7 天」畫出同一張圖，
  // 看起來像切換壞掉。超過實際天數的選項直接不列出來，只留一個「最長就這麼多」的說明。
  const history = detail?.series.length ?? 0;
  const ranges = RANGES.filter((r, i) => i === 0 || RANGES[i - 1].days < history);
  // 伺服器送下來的是完整歷史（最多一年），期間切換只是在前端切片，不用重新向伺服器要。
  const series = useMemo(() => (detail ? detail.series.slice(-days) : []), [detail, days]);
  const stats = useMemo(() => statsOf(series), [series]);

  // 這個品項在三個場所都沒有行情——產季外的水果（11 月的荔枝）就是這樣。這不是錯誤，
  // 所以照樣進頁面，但要講清楚為什麼沒有數字、什麼時候才有。
  if (!detail) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
        <BackRow unit={prefs.unit} onUnitChange={(unit) => setPrefs({ unit })} />
        <ListCard strong className="flex items-center gap-3">
          <ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={20} boxSize={48} />
          <div className="min-w-0">
            <h1 className={text.pageTitle}>{item.name}</h1>
            <p className={text.meta}>{categoryName(item.category)}</p>
          </div>
        </ListCard>
        <EmptyState
          icon="calendar-xmark"
          title="現在沒有這一項的行情"
          description={
            item.season.length > 0
              ? `${item.name}的產季是 ${item.season.join("、")} 月，產季外批發市場與零售市場都不會有交易紀錄。`
              : "資料來源今天沒有這一項的交易紀錄，過幾天再回來看看。"
          }
        />
      </div>
    );
  }

  const { quote } = detail;
  const trend = trendOf(quote);
  const value = valueOf(quote);
  const reliable = hasReliableHistory(quote);


  const markets = [...quote.markets].sort((a, b) => a.avgKg - b.avgKg);

  return (
    <div className="fw-page fw-detail-page">
      <BackRow unit={prefs.unit} onUnitChange={(unit) => setPrefs({ unit })} />

      {/* ── 今日價 ─────────────────────────────────────────── */}
      <ListCard strong className="fw-detail-hero flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={22} boxSize={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className={text.pageTitle}>{item.name}</h1>
              {inSeason && <SeasonBadge />}
              {quote.estimated && <EstimatedBadge />}
            </div>
            <p className={`mt-0.5 truncate ${text.meta}`}>
              {categoryName(item.category)}
              {item.aliases.length > 0 && `・又叫 ${item.aliases.join("、")}`}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <PriceText
              priceKg={quote.avgKg}
              rangeLowKg={quote.rangeLowKg}
              rangeHighKg={quote.rangeHighKg}
              unit={prefs.unit}
              size="big"
              showUnit={false}
            />
            <span className={`ml-1.5 ${text.meta}`}>{unitLabel(prefs.unit)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            {/* 推估的品項不顯示漲跌與划算度：那是把批發的變化乘上一個固定倍數得到的，
                講的其實是批發的漲跌，標在「傳統市場」上會誤導。 */}
            {!quote.estimated && <TrendBadge trend={trend} showFlat />}
            {!quote.estimated && reliable && <ValueBadge value={value} showFair />}
          </div>
        </div>

        {quote.estimated && quote.rangeLowKg !== undefined ? (
          <Note>
            這一項在臺中的零售市場沒有訪價，所以用批發價推估。倍數取自同類別實際觀察到的範圍，所以給的是區間不是單一數字。
          </Note>
        ) : reliable ? (
          <Note>{valueSentence(value, quote.historyDays)}</Note>
        ) : (
          <Note>
            這個場所的歷史資料還在累積（已有 {quote.historyDays} 天，滿 {MIN_HISTORY_DAYS} 天才判斷貴或便宜）。
          </Note>
        )}

        {/* 近一年的價格區間指示條：今天的價格落在這一年的哪個位置，一眼就看得出來。
            歷史不夠長的時候不畫——只有幾天資料的「區間」沒有意義。 */}
        {reliable && !quote.estimated && (
          <div className="flex flex-col gap-1.5">
            <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${colors.downBg}, ${colors.upBg})` }}>
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{ left: `${value.position * 100}%`, backgroundColor: colors.brand, boxShadow: shadow.float }}
              />
            </div>
            <div className="flex items-center justify-between">
              {/* 標籤要說實話：批發行情的歷史是一天一天累積的，只有一百天的時候不能
                  寫「一年最低」（見 price.ts 的 historyLabel）。 */}
              <span className={text.meta}>
                {historyLabel(quote.historyDays)}最低 {formatPriceIn(quote.yearLowKg, prefs.unit)}
              </span>
              <span className={text.meta}>最高 {formatPriceIn(quote.yearHighKg, prefs.unit)}</span>
            </div>
          </div>
        )}

        {/* 資料日期那行要自己佔滿一整列。以前跟按鈕並排（flex-1 + 按鈕），430px 的手機
            上按鈕不會縮，那行就被擠成五行的窄柱：「11/20 ／（五）・傳 ／ 統市場・3 …」。 */}
        <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: colors.borderSoft }}>
          <Hint>
            {formatShortDate(quote.date)}
            {prefs.marketCode ? `・${quote.markets[0]?.marketName ?? ""}` : markets.length > 1 ? `・${markets.length} 個市場的代表價` : ""}
          </Hint>
          <PrimaryButton size="block" icon={starred ? "check" : "plus"} onClick={() => toggleBasket(code, item.name)}>
            {starred ? `已在${copy.basket}` : `加入${copy.basket}`}
          </PrimaryButton>
        </div>

      </ListCard>

      {quote.estimated && (
        <Callout icon="triangle-exclamation">
          {copy.retailCoverageNote}
        </Callout>
      )}
      {quote.date !== today && (
        <Callout icon="calendar-xmark">
          顯示的是 {formatShortDate(quote.date)} 的行情。資料來源還沒更新到今天。
        </Callout>
      )}

      {/* ── 有機／產銷履歷要多付多少 ───────────────────────────
          只有蔬果、而且那五個會回報標章的批發市場當天有成交才出現。這是「超市的有機
          蔬菜貴一倍」之外，少數有公開資料可以回答的問題。 */}
      {detail.traced && (
        <section className="flex flex-col gap-2">
          <SectionTitle leaf>有機／產銷履歷要多付多少</SectionTitle>
          <ListCard className="flex flex-col gap-3">
            <div className="flex items-stretch gap-2">
              <TracedTile
                label="有標章"
                priceKg={detail.traced.certifiedKg}
                unit={prefs.unit}
                highlight={detail.traced.percent > 0}
              />
              <TracedTile label="一般" priceKg={detail.traced.plainKg} unit={prefs.unit} />
            </div>
            <Note>
              {detail.traced.percent === 0
                ? "這一天有標章與一般的批發價幾乎一樣。"
                : detail.traced.percent > 0
                  ? `有產銷履歷／有機標章的批發價貴 ${detail.traced.percent}%。`
                  : `有標章的批發價反而便宜 ${Math.abs(detail.traced.percent)}%（通常是當天的到貨品質或規格差異造成）。`}
            </Note>
            <Hint>
              {formatShortDate(detail.traced.date)}・五個會回報標章的批發市場・有標章的佔當天成交量 {detail.traced.certifiedShare}%
              {detail.traced.certifiedShare < 5 && "（佔比很低，這個均價的代表性有限）"}
            </Hint>
            {/* 來源的代碼表沒有公開，分不出是有機還是產銷履歷，所以不能宣稱種類。 */}
            <Hint>資料來源沒有區分是哪一種標章（有機、產銷履歷…），這裡只分「有標章」與「一般」。</Hint>
          </ListCard>
        </section>
      )}

      {/* ── 走勢 ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>價格走勢</SectionTitle>
        <SegmentedTabs items={ranges} value={ranges.some((r) => r.key === rangeKey) ? rangeKey : ranges[ranges.length - 1].key} onChange={(key) => { setRangeKey(key); if (key !== rangeKey && detail.series.length > 1) record({ type: "chart" }); }} />
        <Paper className="flex flex-col gap-2" style={{ borderRadius: "13px 8px" }}>
          <PriceChart points={series} unit={prefs.unit} averageKg={reliable ? quote.yearAvgKg : undefined} />
          <div className="grid grid-cols-3 gap-2 border-t pt-2.5" style={{ borderColor: colors.borderSoft }}>
            <MiniStat label="這段最低" value={formatPriceIn(stats.minKg, prefs.unit)} />
            <MiniStat label="這段平均" value={formatPriceIn(stats.avgKg, prefs.unit)} />
            <MiniStat label="這段最高" value={formatPriceIn(stats.maxKg, prefs.unit)} />
          </div>
          <Hint>
            這段期間
            {stats.changePercent === 0 ? "幾乎沒變" : stats.changePercent > 0 ? `上漲 ${stats.changePercent}%` : `下跌 ${Math.abs(stats.changePercent)}%`}
            ・共 {stats.count} 個有交易的日子
          </Hint>
          {ranges.length < RANGES.length && (
            <Hint>這一項的歷史只累積到 {history} 天，所以沒有更長的期間可以看。每天的行情會繼續累積上去。</Hint>
          )}
        </Paper>
      </section>

      {/* ── 完整行情表（上/中/下/平均/量）───────────────────────
          這是菜價查詢的標準格式：農業部行情站與市面上的菜價網站都是這五欄，看得懂行情
          的人要的就是這張表。上面那張卡是給「不懂買菜價格的人」的結論，這張表是給要自己
          判讀的人的原始數字，兩種人都要照顧到。 */}
      {markets.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle
            leaf
            action={
              <LinkButton onClick={() => setShowFullTable((v) => !v)}>
                {showFullTable ? "簡化顯示" : "完整行情表"}
              </LinkButton>
            }
          >
            各{copy.market}今天的價格
          </SectionTitle>

          {/* 代表價怎麼算出來的要寫清楚——使用者會拿下面的清單去對上面那個數字，對不起來
              的時候要有地方解釋。零售訪價沒有成交量可以加權，取中位數才不會被單一攤位的
              異常價格拉走（見 prices.server.ts 的 representativePrice）。 */}
          <Note>
            {quote.source === "wholesale"
              ? "上面的代表價是各市場的成交量加權平均。"
              : "上面的代表價是各市場的中位數——訪價沒有成交量可以加權，取中位數才不會被單一攤位的異常價格拉走。"}
          </Note>

          {showFullTable ? (
            // 表格一定要能自己橫向捲動：五欄數字在 430px 寬的手機上塞不進去，讓整頁
            // 左右捲會把底部導覽列也拖走。
            <div className="overflow-x-auto rounded-2xl bg-white" style={{ boxShadow: shadow.card }}>
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    {["市場", "上價", "中價", "下價", "平均", "交易量"].map((h, i) => (
                      <th
                        key={h}
                        className={`whitespace-nowrap px-2.5 py-2 ${text.label} ${i === 0 ? "text-left" : "text-right"}`}
                        style={{ backgroundColor: colors.surfaceSoft }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {markets.map((market) => (
                    <tr key={market.marketCode} className="border-t" style={{ borderColor: colors.borderSoft }}>
                      <td className={`whitespace-nowrap px-2.5 py-2 ${text.body}`}>{market.marketName}</td>
                      {/* 數字欄位用 tabular-nums，位數才會對齊成一直線。 */}
                      <td className={`px-2.5 py-2 text-right tabular-nums ${text.body}`}>
                        {formatPriceIn(market.highKg, prefs.unit)}
                      </td>
                      <td className={`px-2.5 py-2 text-right tabular-nums ${text.body}`}>
                        {typeof market.midKg === "number" ? formatPriceIn(market.midKg, prefs.unit) : "—"}
                      </td>
                      <td className={`px-2.5 py-2 text-right tabular-nums ${text.body}`}>
                        {formatPriceIn(market.lowKg, prefs.unit)}
                      </td>
                      <td className={`px-2.5 py-2 text-right font-semibold tabular-nums ${text.body}`}>
                        {formatPriceIn(market.avgKg, prefs.unit)}
                      </td>
                      <td className={`whitespace-nowrap px-2.5 py-2 text-right tabular-nums ${text.meta}`}>
                        {typeof market.volumeKg === "number" && market.volumeKg > 0
                          ? `${market.volumeKg.toLocaleString("en-US")} kg`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Paper variant="list">
              <CollapsibleList moreLabel={(n) => `還有 ${n} 個市場，展開看`}>
              {markets.map((market, index) => <PriceListRow
                key={market.marketCode}
                art={<FaIcon icon="store" size={40}/>}
                title={market.marketName}
                badges={index === 0 && markets.length > 1 && <span className={text.badge} style={{color: colors.down}}>最低</span>}
                meta={<>
                  {market.city && `${market.city}・`}
                  {market.highKg > market.lowKg ? `上下價 ${formatPriceIn(market.lowKg, prefs.unit)}～${formatPriceIn(market.highKg, prefs.unit)}` : "單一訪價"}
                  {typeof market.volumeKg === "number" && market.volumeKg > 0 && `・成交 ${market.volumeKg.toLocaleString("en-US")} 公斤`}
                </>}
                price={<PriceText priceKg={market.avgKg} unit={prefs.unit} size="row" showUnit={false}/>}
              />)}
              </CollapsibleList>
            </Paper>
          )}

          <Hint>
            上價／中價／下價是當天成交的高、中、低價，價差反映品質與規格的落差。
            {quote.source !== "wholesale" && "零售訪價每個市場只記一個數字，所以沒有中價與交易量。"}
          </Hint>
        </section>
      )}

      {/* ── 產季與買菜提示 ─────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <SectionTitle leaf>什麼時候買最好</SectionTitle>
        <ListCard className="flex flex-col gap-3">
          {item.season.length === 0 ? (
            <Note>這一樣全年都有，沒有特別的產季。</Note>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {MONTH_LABELS.map((label, index) => {
                  const m = index + 1;
                  const on = item.season.includes(m);
                  const isNow = m === month;
                  return (
                    <span
                      key={label}
                      className="grid size-7 place-items-center rounded-lg text-[11px] font-medium"
                      style={{
                        backgroundColor: on ? colors.surfaceActive : colors.surfaceSoft,
                        color: on ? colors.brand : colors.placeholder,
                        // 用外框標示「現在這個月」，不是換底色——底色已經在表達「是不是
                        // 產季」了，同一個視覺通道塞兩種意思會讀不出來。
                        boxShadow: isNow ? `0 0 0 2px ${colors.brand}` : undefined,
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
              <Note>
                {inSeason
                  ? `${month} 月正是產季，這時候的品質通常最好、價格也比較低。`
                  : `產季是 ${item.season.join("、")} 月，現在不是產季，價格通常偏高。`}
              </Note>
            </>
          )}
          {item.note && <Note>{item.note}</Note>}
          <Note>
            份量換算：1 {unitShort("catty")} = 0.6 公斤。{prefs.unit === "catty" ? "目前顯示的是台斤價。" : "目前顯示的是公斤價。"}
          </Note>
        </ListCard>
      </section>


      <QuestSlip />

      <div className="flex justify-center">
        <Link href="/tools/freshwise/basket" className="fw-leaf-link">去看{copy.basket} →</Link>
      </div>
    </div>
  );
}

/** 返回列 ＋ 公斤／台斤切換。放在詳情頁的右上角——這一頁的數字最多，也最需要換算成自己
 *  習慣的單位；換了之後是存回偏好的，所以其他頁面也會跟著變。單位只影響顯示，不用重新
 *  向伺服器要資料。 */
function BackRow({ unit, onUnitChange }: { unit: UnitKey; onUnitChange: (unit: UnitKey) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {/* 返回改用插畫按鈕。圖檔放 public/freshwise/ui-back.png（跟其他介面圖示同一層、
          同一個 ui- 前綴）。 */}
      <Link href="/tools/freshwise/browse" className="fw-back-link" aria-label="回到行情">
        <IllustratedArt src="/freshwise/ui-back.png" size={40} />
        <span>行情</span>
      </Link>
      <SegmentedTabs
        items={[
          { key: "catty", label: "台斤" },
          { key: "kg", label: "公斤" },
        ]}
        value={unit}
        onChange={(key) => onUnitChange(key as UnitKey)}
      />
    </div>
  );
}

/** 有標章／一般的兩格對照。 */
function TracedTile({
  label,
  priceKg,
  unit,
  highlight = false,
}: {
  label: string;
  priceKg: number;
  unit: UnitKey;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-1 flex-col gap-1 rounded-2xl px-3 py-2.5"
      style={{ backgroundColor: highlight ? colors.warningBg : colors.surfaceSoft }}
    >
      <span className={text.meta}>{label}</span>
      <PriceText priceKg={priceKg} unit={unit} size="row" showUnit={false} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={text.meta}>{label}</span>
      <span className={text.bodyStrong}>{value}</span>
    </div>
  );
}
