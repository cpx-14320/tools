"use client";

import { useState } from "react";
import { CompanionOptions } from "@/components/freshwise/companion-widgets";
import { useCompanion } from "@/components/freshwise/companion-store";
import Link from "next/link";
import {
  Callout,
  DangerButton,
  DividedCard,
  DividedRow,
  Field,
  Hint,
  ListCard,
  Note,
  PageTitle,
  SectionTitle,
  SegmentedTabs,
  SelectButton,
  Switch,
} from "@/components/freshwise/ui";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { MarketPickerModal } from "@/components/freshwise/market-picker-modal";
import { EditorSheet } from "@/components/freshwise/editor-sheet";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, text } from "@/components/freshwise/theme";
import { VENUES, venueMeta } from "@/lib/freshwise/catalog";
import { formatShortDate } from "@/lib/freshwise/dates";
import { clearFreshwiseStorage, resetBasket } from "@/lib/freshwise/storage";
import { defaultBasket } from "@/lib/freshwise/basket";
import { KG_PER_CATTY } from "@/lib/freshwise/price";
import type { MarketOption, UnitKey, VenueKey } from "@/lib/freshwise/types";

const VENUE_TABS = VENUES.map((v) => ({ key: v.key, label: v.name, icon: v.icon }));

const UNIT_TABS: readonly { key: UnitKey; label: string }[] = [
  { key: "catty", label: "台斤" },
  { key: "kg", label: "公斤" },
];

/** 漲跌提醒的門檻選項。固定四階，不給自由輸入——使用者對「幾 % 算大漲」沒有精確概念，
 *  給一個數字輸入框只會讓人卡在那裡想，四個選項反而好決定。 */
const ALERT_TABS: readonly { key: string; label: string }[] = [
  { key: "10", label: "10%" },
  { key: "15", label: "15%" },
  { key: "20", label: "20%" },
  { key: "30", label: "30%" },
];

/** 目前實際接上的資料來源。寫在設定頁是刻意的：這個工具的數字關係到使用者花錢，來源
 *  必須是公開可查的。 */
const DATA_SOURCES: readonly { name: string; detail: string; status: "live" | "none" }[] = [
  {
    name: "農產品交易行情（農業部）",
    detail: "全國批發市場的蔬菜、水果每日成交行情，元/公斤。",
    status: "live",
  },
  {
    name: "漁產品交易行情（農業部）",
    detail: "各地魚市場的魚貨每日成交行情，元/公斤。",
    status: "live",
  },
  {
    name: "家禽交易行情（農業部）",
    detail: "白肉雞與雞蛋的產地價，元/台斤。",
    status: "live",
  },
  {
    name: "糧價（農業部）",
    detail: "白米的零售價與批發價，20 個縣市、每日更新——這是唯一一份全國各地都有的零售價。",
    status: "live",
  },
  {
    name: "產銷履歷與有機蔬果行情（農業部）",
    detail: "五個批發市場會回報有無標章，用來算「有機／產銷履歷要多付多少」。",
    status: "live",
  },
  {
    name: "公有零售市場每日蔬果價格（臺中市）",
    detail: "14 個公有零售市場的實際零售訪價，含魚蝦、豬牛雞鴨肉與蛋，元/台斤，滾動一年。",
    status: "live",
  },
  {
    name: "超市量販架上價",
    detail: "沒有任何免費開放資料，只能依零售價推估，所以畫面上一律標示「估算」。",
    status: "none",
  },
];

export function MoreView({
  markets,
  dataDate,
  itemCount,
}: {
  markets: MarketOption[];
  dataDate: string;
  itemCount: number;
}) {
  const { prefs, setPrefs, setVenue, setMarket, setBasket } = useFreshwise();
  const { reset: resetCompanions } = useCompanion();
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const venue = venueMeta(prefs.venue);

  return (
    <div className="fw-page fw-settings-page">
      <PageTitle>我的小手帳</PageTitle>
      <CompanionOptions />

      {/* ── 預設看哪裡的價格 ───────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>預設{copy.venue}</SectionTitle>
        <SegmentedTabs items={VENUE_TABS} value={prefs.venue} onChange={(key: VenueKey) => setVenue(key)} tone="solid" scroll />
        <Note>{venue.description}</Note>

        <Field label={`預設${copy.market}`} as="div">
          <SelectButton
            icon="location-dot"
            value={prefs.marketCode ? (markets.find((m) => m.code === prefs.marketCode)?.name ?? "全部市場") : "全部市場"}
            onClick={() => setMarketPickerOpen(true)}
          />
        </Field>
        <Hint>
          {markets.length > 0
            ? `這個場所今天有 ${markets.length} 個市場回報行情。選「全部市場」就是看它們的平均價。`
            : "超市量販的價格是推估的，沒有個別市場可以選。"}
        </Hint>
      </section>

      {/* ── 顯示單位 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>價格單位</SectionTitle>
        <SegmentedTabs items={UNIT_TABS} value={prefs.unit} onChange={(unit) => setPrefs({ unit })} />
        <Note>
          1 台斤 = {KG_PER_CATTY} 公斤。開放資料裡批發行情是元/公斤、零售訪價是元/台斤，這個工具一律換算成你選的單位再顯示，切換{copy.venue}時會自動換成那邊的慣用單位。
        </Note>
      </section>

      {/* ── 首頁 ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>首頁</SectionTitle>
        <DividedCard>
          <DividedRow>
            <span className="min-w-0 flex-1">
              <span className={text.bodyStrong}>顯示今天的買菜建議</span>
              <span className={`block ${text.meta}`}>關掉之後主視覺只顯示工具名稱</span>
            </span>
            <Switch checked={prefs.showAdvice} onChange={(showAdvice) => setPrefs({ showAdvice })} label="顯示今天的買菜建議" />
          </DividedRow>
        </DividedCard>

        <Field label="大漲大跌的提醒門檻" as="div">
          <SegmentedTabs items={ALERT_TABS} value={String(prefs.alertPercent)} onChange={(key) => setPrefs({ alertPercent: Number(key) })} />
        </Field>
        <Hint>漲跌超過這個幅度的品項會被標成「要注意」。推播提醒還沒做。</Hint>
      </section>

      {/* ── 資料來源 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>資料來源</SectionTitle>
        <ListCard className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Hint>最新資料日期</Hint>
            <span className={text.bodyStrong}>{formatShortDate(dataDate)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <Hint>今天有行情的品項</Hint>
            <span className={text.bodyStrong}>{itemCount} 項</span>
          </div>
          <Note>行情每天更新一次（農業部大約上午公布當天的資料），所以同一天內重新整理不會有新數字。</Note>
        </ListCard>

        <DividedCard>
          {DATA_SOURCES.map((source) => (
            <DividedRow key={source.name}>
              <span className="min-w-0 flex-1">
                <span className={text.bodyStrong}>{source.name}</span>
                <span className={`block ${text.meta}`}>{source.detail}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 ${text.badge}`}
                style={{
                  backgroundColor: source.status === "live" ? colors.downBg : colors.warningBg,
                  color: source.status === "live" ? colors.down : colors.warning,
                }}
              >
                {source.status === "live" ? "已接上" : "無資料來源"}
              </span>
            </DividedRow>
          ))}
        </DividedCard>

        <Callout icon="circle-info">{copy.retailCoverageNote}</Callout>
      </section>

      {/* ── 資料管理 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>這個工具的資料</SectionTitle>
        <ListCard className="flex flex-col gap-2.5">
          <Note>
            {copy.basket}與夥伴進度目前保存在這台裝置，換裝置不會自動同步。
          </Note>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBasket(resetBasket())}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${text.badge}`}
              style={{ backgroundColor: colors.surfaceSoft, color: colors.brand }}
            >
              <FaIcon icon="rotate-left" size={11} className="" color={colors.brand} />
              還原預設{copy.basket}
            </button>
            <DangerButton size="md" className="ml-auto" onClick={() => setResetOpen(true)}>
              清除全部資料
            </DangerButton>
          </div>
        </ListCard>
      </section>

      {/* ── 關於 ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>關於</SectionTitle>
        <DividedCard>
          <DividedRow>
            <span className="min-w-0 flex-1">
              <span className={text.bodyStrong}>
                {copy.appName}（{copy.appNameEn}）
              </span>
              <span className={`block ${text.meta}`}>查今天的蔬果魚肉蛋行情，順便記住你常買的那幾樣。</span>
            </span>
          </DividedRow>
          <DividedRow>
            <Link href="/" className="flex w-full items-center gap-3">
              <span className={`min-w-0 flex-1 ${text.bodyStrong}`}>回到小工具入口頁</span>
              <FaIcon icon="chevron-right" size={12} color={colors.placeholder} />
            </Link>
          </DividedRow>
        </DividedCard>
      </section>

      <MarketPickerModal
        open={marketPickerOpen}
        venue={prefs.venue}
        value={prefs.marketCode}
        markets={markets}
        onClose={() => setMarketPickerOpen(false)}
        onConfirm={(marketCode) => {
          setMarket(marketCode);
          setMarketPickerOpen(false);
        }}
      />

      {/* 清除資料是不可逆的，所以要再確認一次。用編輯器外殼而不是瀏覽器的 confirm()
          ——原生對話框的樣式跟這個 App 完全不搭，而且在手機上會蓋掉整個畫面。 */}
      <EditorSheet
        open={resetOpen}
        title="清除全部資料"
        description={`${copy.basket}、夥伴進度與偏好設定都會被清掉，回到第一次使用的狀態。這個動作沒辦法復原。`}
        onClose={() => setResetOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setResetOpen(false)} className="px-4 py-2 text-sm" style={{ color: colors.muted }}>
              {copy.cancel}
            </button>
            <DangerButton
              size="md"
              onClick={() => {
                // 菜籃（localStorage）跟偏好（cookie）都清掉，再把記憶體裡的狀態設回預設值。
                clearFreshwiseStorage();
                resetCompanions();
                setBasket(defaultBasket());
                setVenue("market");
                setPrefs({ unit: "catty", alertPercent: 15, showAdvice: true });
                setResetOpen(false);
              }}
            >
              確定清除
            </DangerButton>
          </>
        }
      >
        <Hint>清除之後{copy.basket}會回到預設的那幾樣常見家常菜。</Hint>
      </EditorSheet>
    </div>
  );
}
