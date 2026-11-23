"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { IllustratedArt } from "@/components/freshwise/game-art";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";
import { useCompanion } from "@/components/freshwise/companion-store";
import Link from "next/link";
import {
  Callout,
  DangerButton,
  Paper,
  DividedRow,
  Field,
  Hint,
  Note,
  PageTitle,
  SectionTitle,
  SelectButton,
} from "@/components/freshwise/ui";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { MarketPickerModal } from "@/components/freshwise/market-picker-modal";
import { OptionPickerModal } from "@/components/freshwise/option-picker-modal";
import { EditorSheet } from "@/components/freshwise/editor-sheet";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, text } from "@/components/freshwise/theme";
import { formatShortDate } from "@/lib/freshwise/dates";
import { emptyBasket } from "@/lib/freshwise/basket";
import type { MarketOption, UnitKey } from "@/lib/freshwise/types";

const OTHER_TOOL_ICONS: Record<string, string> = { transit: "/freshwise/ui-tool-transit.png", expenses: "/freshwise/ui-tool-expenses.png", compress: "/freshwise/ui-tool-compress.png" };


const UNIT_OPTIONS: readonly { key: UnitKey; label: string; note: string }[] = [
  { key: "catty", label: "台斤", note: "台灣市場的習慣單位" },
  { key: "kg", label: "公斤", note: "開放資料的原始單位" },
];


/** 目前實際接上的資料來源。寫在設定頁是刻意的：這個工具的數字關係到使用者花錢，來源
 *  必須是公開可查的。 */
/** 資料來源一覽。只留名字——使用者要知道的是「數字從哪來」，不是每一支 API 的欄位
 *  說明。「超市量販架上價」那筆已經拿掉：場所選項移除之後畫面上根本沒有超市了。 */
const DATA_SOURCES: readonly string[] = [
  "公有零售市場每日蔬果價格（臺中市）",
  "農產品交易行情（農業部）",
  "漁產品交易行情（農業部）",
  "家禽交易行情（農業部）",
  "糧價（農業部）",
  "產銷履歷與有機蔬果行情（農業部）",
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
  const { prefs, setPrefs, setMarket, setBasket } = useFreshwise();
  const { user, loading: authLoading, logout } = useAuth();
  const otherTools = TOOLS_REGISTRY.filter((tool) => OTHER_TOOL_ICONS[tool.toolId] && user?.tools.includes(tool.toolId));
  const { reset: resetCompanions } = useCompanion();
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="fw-page fw-settings-page">
      <PageTitle hanging>我的設定</PageTitle>

      {/* ── 預設看哪裡的價格 ───────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>預設查詢條件</SectionTitle>

        <Field label={`預設${copy.market}`} as="div">
          <SelectButton
            icon="location-dot"
            value={prefs.marketCode ? (markets.find((m) => m.code === prefs.marketCode)?.name ?? "全部市場") : "全部市場"}
            onClick={() => setMarketPickerOpen(true)}
          />
        </Field>
        <Field label="價格單位" as="div">
          <SelectButton
            icon="tag"
            value={UNIT_OPTIONS.find((o) => o.key === prefs.unit)?.label ?? "台斤"}
            onClick={() => setUnitPickerOpen(true)}
          />
        </Field>

      </section>

      {/* ── 資料來源 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>資料來源</SectionTitle>
        <Paper variant="flush" className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Hint>最新資料日期</Hint>
            <span className={text.bodyStrong}>{formatShortDate(dataDate)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <Hint>今天有行情的品項</Hint>
            <span className={text.bodyStrong}>{itemCount} 項</span>
          </div>
        </Paper>

        <Paper variant="flush" className="fw-stack">
          {DATA_SOURCES.map((name) => (
            <DividedRow key={name}>
              <span className={`min-w-0 flex-1 ${text.bodySm}`}>{name}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 ${text.badge}`}
                style={{ backgroundColor: colors.downBg, color: colors.down }}
              >
                已接上
              </span>
            </DividedRow>
          ))}
        </Paper>

        <Callout icon="circle-info" size="sm">{copy.retailCoverageNote}</Callout>
      </section>

      {/* ── 資料管理 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>買菜日記</SectionTitle>
        <Paper variant="flush" className="flex flex-col gap-2.5">
          <Note>
            {copy.basket}、偏好與夥伴進度都跟著帳號走，換手機、換瀏覽器登入看到的是同一份。
          </Note>
          <DangerButton size="md" className="self-end" onClick={() => setResetOpen(true)}>
            清除全部資料
          </DangerButton>
        </Paper>
      </section>

      <section className="flex flex-col gap-2.5" aria-label="其他小工具">
        <SectionTitle leaf>其他小工具</SectionTitle>
        <Paper variant="flush" className="fw-stack fw-other-tools">
          {authLoading ? <Hint>{copy.loading}</Hint> : otherTools.length === 0 ? <Hint>目前沒有其他小工具的使用權限</Hint> : otherTools.map((tool) => <Link key={tool.toolId} href={tool.href} className="fw-other-tool-link fw-stack-row">
            <IllustratedArt src={OTHER_TOOL_ICONS[tool.toolId]} size={48}/>
            <span className={`min-w-0 flex-1 ${text.bodyStrong}`}>{tool.name}</span>
            <FaIcon icon="chevron-right" size={12} color={colors.placeholder}/>
          </Link>)}
        </Paper>
      </section>


      {/* ── 帳號 ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>帳號</SectionTitle>
        <Paper variant="flush" className="flex items-center justify-between gap-3">
          <Note>{user?.name ? `目前登入：${user.name}` : "目前登入中"}</Note>
          <DangerButton size="md" onClick={() => void handleLogout()}>
            登出
          </DangerButton>
        </Paper>
      </section>

      <OptionPickerModal
        open={unitPickerOpen}
        title="價格單位"
        value={prefs.unit}
        options={UNIT_OPTIONS}
        onClose={() => setUnitPickerOpen(false)}
        onConfirm={(unit) => setPrefs({ unit })}
      />

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
        description={`${copy.basket}會清空，夥伴進度與價格單位會重設。這個動作沒辦法復原。`}
        onClose={() => setResetOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setResetOpen(false)} className="px-4 py-2 text-sm" style={{ color: colors.muted }}>
              {copy.cancel}
            </button>
            <DangerButton
              size="md"
              onClick={() => {
                // 三種資料都在帳號底下：夥伴進度走自己的 API，偏好與菜籃走 store
                // （它會寫回伺服器）。不用再清 localStorage／cookie——那裡已經沒有資料了。
                resetCompanions();
                setBasket(emptyBasket());
                setPrefs({ unit: "catty" });
                setResetOpen(false);
              }}
            >
              確定清除
            </DangerButton>
          </>
        }
      >
        <Hint>清空後不會自動補回預設內容，也可以在菜籃頁自行刪除不需要的分類。</Hint>
      </EditorSheet>
    </div>
  );
}
