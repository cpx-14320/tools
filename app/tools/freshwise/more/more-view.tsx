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
import { resetBasket } from "@/lib/freshwise/storage";
import { defaultBasket } from "@/lib/freshwise/basket";
import type { MarketOption, UnitKey } from "@/lib/freshwise/types";

const OTHER_TOOL_ICONS: Record<string, string> = { transit: "/freshwise/ui-tool-transit.png", expenses: "/freshwise/ui-tool-expenses.png", compress: "/freshwise/ui-tool-compress.png" };


const UNIT_OPTIONS: readonly { key: UnitKey; label: string; note: string }[] = [
  { key: "catty", label: "台斤", note: "台灣市場的習慣單位" },
  { key: "kg", label: "公斤", note: "開放資料的原始單位" },
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
      <PageTitle hanging>我的小手帳</PageTitle>

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
          <Note>行情每天更新一次（農業部大約上午公布當天的資料），所以同一天內重新整理不會有新數字。</Note>
        </Paper>

        <Paper variant="flush" className="fw-stack">
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
        </Paper>

        <Callout icon="circle-info">{copy.retailCoverageNote}</Callout>
      </section>

      <section className="flex flex-col gap-2.5" aria-label="其他小工具">
        <SectionTitle leaf>其他小工具</SectionTitle>
        <Paper variant="flush" className="fw-stack fw-other-tools">
          {authLoading ? <Hint>{copy.loading}</Hint> : otherTools.length === 0 ? <Hint>目前沒有其他小工具的使用權限</Hint> : otherTools.map((tool) => <Link key={tool.toolId} href={tool.href} className="fw-other-tool-link">
            <IllustratedArt src={OTHER_TOOL_ICONS[tool.toolId]} size={48}/>
            <span className={`min-w-0 flex-1 ${text.bodyStrong}`}>{tool.name}</span>
            <FaIcon icon="chevron-right" size={12} color={colors.placeholder}/>
          </Link>)}
        </Paper>
      </section>

      {/* ── 資料管理 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>這個工具的資料</SectionTitle>
        <Paper variant="flush" className="flex flex-col gap-2.5">
          <Note>
            {copy.basket}、偏好與夥伴進度都跟著帳號走，換手機、換瀏覽器登入看到的是同一份。
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
        </Paper>
      </section>

      {/* ── 帳號 ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>帳號</SectionTitle>
        <Paper variant="flush" className="flex flex-col gap-2.5">
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
                // 三種資料都在帳號底下：夥伴進度走自己的 API，偏好與菜籃走 store
                // （它會寫回伺服器）。不用再清 localStorage／cookie——那裡已經沒有資料了。
                resetCompanions();
                setBasket(defaultBasket());
                setPrefs({ unit: "catty" });
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
