"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { IconImg } from "@/components/expenses/icon-img";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { PageHeader } from "@/components/expenses/page-header";
import { text } from "@/components/expenses/theme";

interface SettingItem {
  href: string;
  label: string;
  desc: string;
  icon: string;
}

/** 設定頁依用途分成幾個小區，比照搭乘車設定頁的「小標題＋一張分隔卡片」排法，不要像
 *  之前那樣九個項目擠成一長條、看不出哪些是同一類的東西。 */
const GROUPS: { heading: string; items: SettingItem[] }[] = [
  {
    heading: "記帳設定",
    items: [
      { href: "/tools/expenses/categories", label: "收支分類", desc: "管理支出與收入的分類、子分類", icon: ICON_PATHS.settingCategories },
      { href: "/tools/expenses/budgets", label: "預算設定", desc: "依月份設定各分類的預算", icon: ICON_PATHS.settingBudgets },
    ],
  },
  {
    heading: "帳戶與資產",
    items: [
      { href: "/tools/expenses/assets", label: "資產總表", desc: "看淨資產、各帳戶餘額", icon: ICON_PATHS.settingAssets },
      { href: "/tools/expenses/account-types", label: "帳戶類型", desc: "自訂資產/負債的帳戶類型", icon: ICON_PATHS.settingAccountTypes },
    ],
  },
  {
    heading: "目標與排程",
    items: [
      { href: "/tools/expenses/goals", label: "存錢目標", desc: "設定目標、追蹤進度", icon: ICON_PATHS.settingGoals },
      { href: "/tools/expenses/recurring", label: "固定收支", desc: "房租、電話費這種週期收支", icon: ICON_PATHS.settingRecurring },
    ],
  },
  {
    heading: "匯出／匯入紀錄",
    items: [
      { href: "/tools/expenses/more/export", label: "匯出資料", desc: "消費紀錄、分類、帳戶類型", icon: ICON_PATHS.settingExport },
      { href: "/tools/expenses/more/import", label: "匯入資料", desc: "上傳 CSV 批次建立", icon: ICON_PATHS.settingImport },
    ],
  },
];

type ResetScope = "records" | "all";

export function MoreView() {
  const router = useRouter();
  const { logout } = useAuth();
  const [resetScope, setResetScope] = useState<ResetScope | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  async function handleReset(scope: ResetScope) {
    const data: { total?: number } = await fetch("/api/expenses/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setResult(`已清除 ${data.total ?? 0} 筆資料。`);
    router.refresh();
  }

  return (
    <div>
      <PageHeader title="設定" />

      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <p className={`mb-2 px-1 ${text.label}`}>{group.heading}</p>
            <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F3EFFC]">
                  {/* 不帶底色方塊，跟搭乘車設定頁「其他小工具」那排一樣，圖直接放在白底上
                      （圖本身是去背的）。圖檔還沒放進 public/expenses 之前這裡會是空白。 */}
                  <IconImg src={item.icon} alt={item.label} size={40} background={false} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${text.body}`}>{item.label}</span>
                    <span className={`block ${text.muted}`}>{item.desc}</span>
                  </span>
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className={`mb-2 px-1 ${text.label}`}>帳號</p>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-center text-sm font-medium text-[#4A3B7C]"
          >
            登出
          </button>
        </div>

        {/* 清除資料沒有還原機制，所以獨立成一區、文字用警示色，而且兩顆都要打字確認過
            才會真的送出（見 ConfirmModal 的 requireText）。 */}
        <div>
          <p className={`mb-2 px-1 ${text.label}`}>清除資料</p>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
            <button type="button" onClick={() => setResetScope("records")} className="px-4 py-3.5 text-left active:bg-[#FDEEF0]">
              <span className="block text-sm font-medium text-[#D1517E]">清除所有消費紀錄</span>
              <span className={`block ${text.muted}`}>只刪交易與轉帳，分類、帳戶、目標都保留</span>
            </button>
            <button type="button" onClick={() => setResetScope("all")} className="px-4 py-3.5 text-left active:bg-[#FDEEF0]">
              <span className="block text-sm font-medium text-[#D1517E]">清除全部資料</span>
              <span className={`block ${text.muted}`}>連自己加的分類、帳戶、類型、目標、固定收支、預算一起清空（預設的不會刪）</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={resetScope !== null}
        title={resetScope === "all" ? "清除全部資料" : "清除所有消費紀錄"}
        message={
          resetScope === "all"
            ? "會把記帳本底下的東西清空：交易、轉帳、你自己新增的分類／帳戶／帳戶類型、存錢目標、固定收支、預算。系統預設的分類跟「現金錢包」「銀行帳戶」會保留下來。刪掉就沒了，沒有還原機制，建議先去「匯出資料」備份一份。"
            : "會刪掉所有交易與轉帳紀錄，分類、帳戶、帳戶類型、目標、固定收支、預算都會保留。刪掉就沒了，沒有還原機制，建議先去「匯出資料」備份一份。"
        }
        confirmLabel="確定清除"
        requireText={resetScope === "all" ? "清除全部" : "清除紀錄"}
        onConfirm={() => resetScope && handleReset(resetScope)}
        onClose={() => setResetScope(null)}
      />

      <ConfirmModal open={result !== null} title="清除完成" message={result ?? ""} onlyAcknowledge onClose={() => setResult(null)} />
    </div>
  );
}
