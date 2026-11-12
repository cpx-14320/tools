"use client";

import { useState } from "react";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { PageHeader } from "@/components/expenses/page-header";
import { StickyToolbar } from "@/components/expenses/sticky-toolbar";
import { Badge } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { text } from "@/components/expenses/theme";
import { GoalModal, type GoalModalDraft } from "@/components/expenses/goal-modal";
import { useBusy } from "@/components/expenses/busy";
import { goalProgress, goalPace, type SavingsGoalDTO } from "@/lib/expenses/goals";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import { formatCurrency, formatDateRange } from "@/lib/format";

type ModalState = { mode: "create" } | { mode: "edit"; goal: SavingsGoalDTO };

/** 目標清單由 page.tsx 在伺服器端讀好傳進來（見那支的說明）。之後的新增／編輯／刪除
 *  照舊走 API，handler 拿回傳的完整清單 setState，所以這份 state 一直是最新的。 */
export function GoalsView({
  initialGoals,
  /** 給編輯彈窗的「綁定帳戶」用；列表上顯示綁的是哪個帳戶也要查名稱。 */
  accounts,
  accountTypes,
}: {
  initialGoals: SavingsGoalDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const showToast = useToast();
  const showDeleteToast = useUndoDelete();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const runBusy = useBusy();

  async function handleSave(draft: GoalModalDraft) {
    if (!modal) return;
    await runBusy("儲存中…", async () => {
    if (modal.mode === "edit") {
      const data: { goals?: SavingsGoalDTO[] } = await fetch("/api/expenses/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: modal.goal.id,
          name: draft.name,
          icon: draft.icon,
          targetAmount: draft.targetAmount,
          // 綁定帳戶時不送 currentAmount：那種目標的進度是帳戶餘額算出來的，送一個
          // 數字過去只會在資料庫裡留下一個誤導人的殘留值。
          ...(draft.accountId ? {} : { currentAmount: draft.currentAmount }),
          accountId: draft.accountId,
          startDate: draft.startDate,
          targetDate: draft.targetDate,
        }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.goals) setGoals(data.goals);
    } else {
      const data: { goals?: SavingsGoalDTO[] } = await fetch("/api/expenses/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.goals) setGoals(data.goals);
    }
    });
    showToast(modal.mode === "edit" ? TOAST.saved : TOAST.created);
    setModal(null);
  }

  async function performDelete(ids: string[]) {
    let latest = goals;
    const trashIds: (string | undefined)[] = [];
    for (const id of ids) {
      const data: { goals?: SavingsGoalDTO[]; trashId?: string } = await fetch(`/api/expenses/goals?id=${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.goals) latest = data.goals;
      trashIds.push(data.trashId);
    }
    setGoals(latest);
    showDeleteToast(
      trashIds,
      async () => {
        const fresh: { goals?: SavingsGoalDTO[] } = await fetch("/api/expenses/goals").then((r) => r.json());
        if (fresh.goals) setGoals(fresh.goals);
      },
      ids.length === 1 ? TOAST.deleted : `已刪除 ${ids.length} 筆`,
    );
  }

  function requestDelete() {
    if (modal?.mode !== "edit") return;
    setModal(null);
    setDeleteConfirm([modal.goal.id]);
  }

  async function handleConfirmedDelete() {
    if (!deleteConfirm) return;
    await runBusy("刪除中…", () => performDelete(deleteConfirm));
    setDeleteConfirm(null);
    selection.exit();
  }

  const selection = useSelection(goals.map((g) => g.id));

  return (
    <div className="flex flex-col gap-4">
      {/* 標題跟「選取」排同一列，整塊一起釘在卡片頂端（見 StickyToolbar）——這一頁右邊
          只有一顆按鈕，自己佔一列的話左邊整片空著，還多墊高一截。 */}
      <StickyToolbar>
        <PageHeader
          flush
          title="存錢目標"
          help="設定目標金額，追蹤存了多少、還差多少"
          actions={<SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />}
        />
        {selection.selecting && (
          <SelectionBar
            count={selection.selectedIds.size}
            total={selection.total}
            onToggleAll={selection.toggleAll}
            onDelete={() => setDeleteConfirm([...selection.selectedIds])}
          />
        )}
      </StickyToolbar>

      <FloatingAddButton onClick={() => setModal({ mode: "create" })} label="新增存錢目標" />

      <GoalModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        // DTO 的 accountId 是「沒綁定就不存在」，彈窗的 draft 用 null 表示同一件事
        // （它要能表達「這次要解除綁定」，undefined 在 PUT 那邊代表「不動」）。
        initial={modal?.mode === "edit" ? { ...modal.goal, accountId: modal.goal.accountId ?? null } : undefined}
        accounts={accounts}
        accountTypes={accountTypes}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? requestDelete : undefined}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="確定要刪除目標嗎？"
        message={`刪除後這${(deleteConfirm?.length ?? 0) > 1 ? ` ${deleteConfirm?.length} 個` : "個"}目標跟累積進度就不會再出現在清單上。還有固定收支連著的話，連動也會一併解除。目標刪掉就沒了，不會進「最近刪除」。`}
        onConfirm={handleConfirmedDelete}
        onClose={() => setDeleteConfirm(null)}
      />


      {goals.length === 0 ? (
        <p className={text.faint}>還沒有任何目標，點右下角的＋新增第一個</p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => {
            const { pct, remaining, achieved } = goalProgress(goal);
            const pace = goalPace(goal);
            const boundAccount = goal.accountId ? accounts.find((a) => a.id === goal.accountId) : undefined;
            return (
              <Card key={goal.id}>
                {/* 整張卡就是進編輯彈窗的入口（選取模式下改成勾選）。
                    本來是「點名稱進編輯、點右上角的鉛筆開存入」：同一張卡上兩個不同的
                    點擊目標，而且鉛筆這個圖示看起來就是「編輯」，點下去卻是存入。存入
                    已經併進編輯彈窗了，所以這裡只剩一種行為，整張卡都可以點。 */}
                <CardBody>
                  {/* button 包住整張卡的內容而不是換掉 CardBody：CardBody 只管內距，
                      讓它變成按鈕會讓每一個用到它的頁面都多一個不該有的 as 參數。 */}
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => (selection.selecting ? selection.toggle(goal.id) : setModal({ mode: "edit", goal }))}
                  >
                    <div className="flex items-center gap-3">
                      {/* 選取模式下打勾圓點排在圖示左邊，圖示不要換掉——少了圖只剩文字，
                        一整排目標長得一模一樣，很難確認自己勾的是哪一個。 */}
                      {selection.selecting && <SelectionDot selected={selection.selectedIds.has(goal.id)} />}
                      <IconAvatar icon={goal.icon} />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className={text.sectionHeading}>{goal.name}</span>
                          {achieved && <Badge tone="positive">已達成</Badge>}
                        </div>
                        <p className={`mt-0.5 ${text.muted}`}>
                          {/* 綁定帳戶的目標要講清楚進度是從哪裡來的，不然使用者會想「我沒
                            按過存入，為什麼它自己在動」。 */}
                          {boundAccount
                            ? `跟著「${boundAccount.name}」的餘額`
                            : formatDateRange(goal.startDate, goal.targetDate) || "沒有設定期限"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex items-end justify-between">
                      <p className={text.statValue}>
                        {formatCurrency(goal.currentAmount)}
                        <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(goal.targetAmount)}</span>
                      </p>
                      <p className={text.muted}>{achieved ? "目標達成" : `還差 ${formatCurrency(remaining)}`}</p>
                    </div>
                    <div className="mt-2">
                      <ProgressBar pct={pct} tone={achieved ? "positive" : "brand"} />
                    </div>
                    <p className={`mt-1 text-right ${text.muted}`}>{pct}%</p>
                    {boundAccount && (formatDateRange(goal.startDate, goal.targetDate) || "") && (
                      <p className={`mt-1 text-left ${text.faint}`}>{formatDateRange(goal.startDate, goal.targetDate)}</p>
                    )}

                    {pace && (
                      <p className="mt-2 rounded-xl bg-[#F9F7FE] px-3 py-2 text-left text-xs text-[#9C94C4]">
                        距離目標還有 {pace.weeksLeft} 週（約 {pace.monthsLeft} 個月）——平均每週要存{" "}
                        <span className="font-medium text-[#4A3B7C]">{formatCurrency(pace.perWeek)}</span>
                        ，或每月存 <span className="font-medium text-[#4A3B7C]">{formatCurrency(pace.perMonth)}</span>
                      </p>
                    )}
                  </button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
