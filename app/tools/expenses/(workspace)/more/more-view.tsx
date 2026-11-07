"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { IconImg } from "@/components/expenses/icon-img";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { Badge } from "@/components/expenses/button";
import { ListCard } from "@/components/expenses/list-row";
import { PageHeader } from "@/components/expenses/page-header";
import { text } from "@/components/expenses/theme";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";
import { AiSettingsSection } from "@/components/expenses/ai/ai-settings-section";
import { TrashModal } from "@/components/expenses/trash-modal";
import type { TrashItemDTO } from "@/lib/expenses/trash";
import type { AiDraftDTO } from "@/lib/expenses/ai-drafts";
import type { CategoryDTO } from "@/lib/expenses/categories";

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
    // 這一區是「記帳之前要先定義好的東西」：分類、預算、帳戶類型。資產總表不放這裡——
    // 設定頁只處理設定，看餘額跟淨資產是資產頁的事，底部導覽列本來就有入口。
    heading: "分類、預算與帳戶",
    items: [
      { href: "/tools/expenses/categories", label: "收支分類", desc: "管理支出與收入的分類、子分類", icon: ICON_PATHS.settingCategories },
      { href: "/tools/expenses/budgets", label: "預算設定", desc: "依月份設定各分類的預算", icon: ICON_PATHS.settingBudgets },
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
      { href: "/tools/expenses/more/data", label: "匯出／匯入資料", desc: "消費紀錄、分類、預算設定的 CSV", icon: ICON_PATHS.settingExport },
    ],
  },
];

type ResetScope = "records" | "all";

/** 這一頁所屬的工具，用來把自己從「其他小工具」的清單裡排除。 */
const CURRENT_TOOL_ID = "expenses";

export function MoreView({
  /** 固定收支有幾期到期還沒確認——只拿來在那一列右邊掛一顆數字徽章。到期的那幾期現在
   *  不會自動入帳（見 recurring-rules.server.ts 的 listPendingOccurrences），不在這裡提示
   *  的話，使用者要自己想到去固定收支頁才看得到。
   *
   *  由 page.tsx 在伺服器上算好傳進來。清除資料後的 router.refresh() 會重跑那一頁，
   *  這個數字跟著歸零，不用自己再打一次 API。 */
  pendingCount,
  aiEnabled,
  aiDrafts,
  categories,
  trash,
}: {
  pendingCount: number;
  /** AI 記帳整區的狀態。整個功能在這一頁的接觸點只有下面那一行 <AiSettingsSection />，
   *  不要的話刪那一行＋刪 components/expenses/ai/ 資料夾就乾淨了。 */
  aiEnabled: boolean;
  aiDrafts: AiDraftDTO[];
  /** 待確認清單要用它顯示分類、補分類。 */
  categories: CategoryDTO[];
  /** 垃圾桶裡的項目。空的時候那一區整個不顯示（見下面）。 */
  trash: TrashItemDTO[];
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const otherTools = TOOLS_REGISTRY.filter((t) => t.toolId !== CURRENT_TOOL_ID && (user?.tools ?? []).includes(t.toolId));
  const [trashItems, setTrashItems] = useState(trash);
  const [trashOpen, setTrashOpen] = useState(false);
  const [resetScope, setResetScope] = useState<ResetScope | null>(null);
  // 預設不勾：清資料多半是想重新記帳，不是想放棄養成進度。
  const [resetPet, setResetPet] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  async function handleReset(scope: ResetScope) {
    const data: { total?: number } = await fetch("/api/expenses/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, includePet: scope === "all" && resetPet }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setResult(`已清除 ${data.total ?? 0} 筆資料。`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader flush title="設定" />

      <div className="flex flex-col gap-5">
        {GROUPS.map((group) => (
          <div key={group.heading}>
            <p className={`mb-2 px-1 ${text.label}`}>{group.heading}</p>
            <ListCard>
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F3EFFC]">
                  {/* 不帶底色方塊，跟搭乘車設定頁「其他小工具」那排一樣，圖直接放在白底上
                      （圖本身是去背的）。圖檔還沒放進 public/expenses 之前這裡會是空白。 */}
                  <IconImg src={item.icon} alt={item.label} size={36} background={false} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${text.body}`}>{item.label}</span>
                    <span className={`block ${text.muted}`}>{item.desc}</span>
                  </span>
                  {item.href === "/tools/expenses/recurring" && pendingCount > 0 && (
                    <Badge tone="negative">{pendingCount} 筆待確認</Badge>
                  )}
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </Link>
              ))}
            </ListCard>
          </div>
        ))}

        {/* AI 記帳：緊接在上面那幾組功能入口後面——它是一個可以開關的附加功能，跟那幾組
            「記帳本的設定」是同一層；放到帳號／清除資料後面會像是系統層級的東西。 */}
        <AiSettingsSection initialEnabled={aiEnabled} initialDrafts={aiDrafts} categories={categories} />

        {/* 其他小工具——比照搭乘車設定頁同名區塊：列出這個帳號有權限、而且不是現在這個
            工具的項目，點了直接跳過去。清單是 TOOLS_REGISTRY（純靜態資料），不用另外打 API。
            擺在 AI 記帳底下：上面全部都是「記帳本自己的設定」，這一塊是離開記帳本去別的
            工具，夾在中間會把同一類的設定切成兩半。 */}
        {otherTools.length > 0 && (
          <div>
            <p className={`mb-2 px-1 ${text.label}`}>其他小工具</p>
            <ListCard>
              {otherTools.map((tool) => (
                <Link key={tool.toolId} href={tool.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F3EFFC]">
                  {tool.iconImage ? (
                    <IconImg src={tool.iconImage} alt={tool.name} size={36} background={false} />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-base">{tool.icon}</span>
                  )}
                  <span className={`min-w-0 flex-1 ${text.body}`}>{tool.name}</span>
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </Link>
              ))}
            </ListCard>
          </div>
        )}

        {/* 最近刪除擺在「清除資料」正上方：兩者講的是同一件事的兩端（刪掉的東西去哪了、
            怎麼真的清掉），放在一起才讀得出關係。垃圾桶是空的時候整區不顯示，不要讓一個
            平常用不到的東西天天佔版面。 */}
        {trashItems.length > 0 && (
          <div>
            <p className={`mb-2 px-1 ${text.label}`}>最近刪除</p>
            <ListCard>
              <button type="button" onClick={() => setTrashOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]">
                <span className={`min-w-0 flex-1 ${text.body}`}>已刪除的項目</span>
                <span className="shrink-0 rounded-full bg-[#F3EFFC] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#6F5FD6]">
                  {trashItems.length}
                </span>
                <span className={text.faint}>›</span>
              </button>
            </ListCard>
          </div>
        )}

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
          <ListCard>
            <button type="button" onClick={() => setResetScope("records")} className="px-4 py-3.5 text-left active:bg-[#FDEEF0]">
              <span className="block text-sm font-medium text-[#D1517E]">清除所有消費紀錄</span>
              <span className={`block ${text.muted}`}>只刪交易與轉帳，分類、帳戶、目標都保留</span>
            </button>
            <button type="button" onClick={() => setResetScope("all")} className="px-4 py-3.5 text-left active:bg-[#FDEEF0]">
              <span className="block text-sm font-medium text-[#D1517E]">清除全部資料</span>
              <span className={`block ${text.muted}`}>
                連自己加的分類、帳戶、類型、目標、固定收支、預算一起清空（預設的不會刪）。養成進度預設保留，可以在確認時一併清除
              </span>
            </button>
          </ListCard>
        </div>
      </div>

      <TrashModal
        open={trashOpen}
        items={trashItems}
        onClose={() => setTrashOpen(false)}
        onItemsChange={setTrashItems}
        // 還原之後固定收支的待確認筆數可能會變（還原一條規則＝它過去的期數又回來了），
        // 整頁重抓最簡單也最不會漏。
        onRestored={() => router.refresh()}
      />

      <ConfirmModal
        open={resetScope !== null}
        title={resetScope === "all" ? "清除全部資料" : "清除所有消費紀錄"}
        message={
          resetScope === "all"
            ? "會把記帳本底下的東西清空：交易、轉帳、你自己新增的分類／帳戶／帳戶類型、存錢目標、固定收支、預算。系統預設的分類跟「現金錢包」「銀行帳戶」會保留下來。養成進度（星星幣、等級、買過的服裝背景）預設不會動，要一起清的話勾下面那一項。刪掉就沒了，沒有還原機制，建議先去「匯出資料」備份一份。"
            : "會刪掉所有交易與轉帳紀錄，分類、帳戶、帳戶類型、目標、固定收支、預算都會保留。養成進度也不會動。刪掉就沒了，沒有還原機制，建議先去「匯出資料」備份一份。"
        }
        option={
          resetScope === "all"
            ? { label: "一併清除養成進度（星星幣、等級、買過的服裝背景、簽到紀錄）", checked: resetPet, onChange: setResetPet }
            : undefined
        }
        confirmLabel="確定清除"
        requireText={resetScope === "all" ? "清除全部" : "清除紀錄"}
        onConfirm={async () => {
          if (resetScope) await handleReset(resetScope);
        }}
        onClose={() => {
          setResetScope(null);
          // 關掉就把勾選歸零——下次打開不該留著上次的選擇，那是會多刪東西的方向。
          setResetPet(false);
        }}
      />

      <ConfirmModal open={result !== null} title="清除完成" message={result ?? ""} onlyAcknowledge onClose={() => setResult(null)} />
    </div>
  );
}
