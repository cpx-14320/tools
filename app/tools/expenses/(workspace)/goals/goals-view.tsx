"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { text } from "@/components/expenses/theme";
import { GoalModal, ContributeModal, type GoalModalDraft } from "@/components/expenses/goal-modal";
import { goalProgress, goalPace, type SavingsGoalDTO } from "@/lib/expenses/goals";
import { formatCurrency } from "@/lib/format";

type ModalState = { mode: "create" } | { mode: "edit"; goal: SavingsGoalDTO };

export function GoalsView() {
  const [goals, setGoals] = useState<SavingsGoalDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/expenses/goals")
      .then((res) => res.json())
      .then((data: { goals?: SavingsGoalDTO[] }) => {
        if (cancelled) return;
        setGoals(data.goals ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: GoalModalDraft) {
    if (!modal) return;
    if (modal.mode === "edit") {
      const data: { goals?: SavingsGoalDTO[] } = await fetch("/api/expenses/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: modal.goal.id,
          name: draft.name,
          icon: draft.icon,
          targetAmount: draft.targetAmount,
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
    setModal(null);
  }

  async function performDelete(ids: string[]) {
    let latest = goals;
    for (const id of ids) {
      const data: { goals?: SavingsGoalDTO[] } = await fetch(`/api/expenses/goals?id=${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.goals) latest = data.goals;
    }
    setGoals(latest);
  }

  function requestDelete() {
    if (modal?.mode !== "edit") return;
    setModal(null);
    setDeleteConfirm([modal.goal.id]);
  }

  async function handleConfirmedDelete() {
    if (!deleteConfirm) return;
    await performDelete(deleteConfirm);
    setDeleteConfirm(null);
    selection.exit();
  }

  async function handleContribute(amount: number) {
    if (!contributeId) return;
    const data: { goals?: SavingsGoalDTO[] } = await fetch("/api/expenses/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contributeId, amount }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.goals) setGoals(data.goals);
    setContributeId(null);
  }

  const selection = useSelection(goals.map((g) => g.id));

  return (
    <div>
      <PageHeader
        title="存錢目標"
        description="設定目標金額，追蹤存了多少、還差多少"
        actions={<SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />}
      />

      <FloatingAddButton onClick={() => setModal({ mode: "create" })} label="新增存錢目標" />

      <GoalModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        initial={modal?.mode === "edit" ? modal.goal : undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? requestDelete : undefined}
      />
      <ContributeModal open={contributeId !== null} onClose={() => setContributeId(null)} onSave={handleContribute} />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="確定要刪除目標嗎？"
        message={`刪除後這${(deleteConfirm?.length ?? 0) > 1 ? ` ${deleteConfirm?.length} 個` : "個"}目標跟累積進度都會不見，無法復原。還有固定收支連著的話，連動也會一併解除。`}
        onConfirm={handleConfirmedDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={() => setDeleteConfirm([...selection.selectedIds])}
        />
      )}

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : goals.length === 0 ? (
        <p className={text.faint}>還沒有任何目標，點右下角的＋新增第一個</p>
      ) : (
        <div className="flex flex-col gap-4">
          {goals.map((goal) => {
            const { pct, remaining, achieved } = goalProgress(goal);
            const pace = goalPace(goal);
            return (
              <Card key={goal.id}>
                <CardBody>
                  <div className="flex items-start gap-3">
                    {selection.selecting ? (
                      <button type="button" onClick={() => selection.toggle(goal.id)} className="shrink-0 pt-1">
                        <SelectionDot selected={selection.selectedIds.has(goal.id)} />
                      </button>
                    ) : (
                      <IconAvatar icon={goal.icon} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {selection.selecting ? (
                          <span className={text.sectionHeading}>{goal.name}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setModal({ mode: "edit", goal })}
                            className={`${text.sectionHeading} hover:underline`}
                          >
                            {goal.name}
                          </button>
                        )}
                        {achieved && <Badge tone="positive">已達成</Badge>}
                      </div>
                      <p className={`mt-0.5 ${text.muted}`}>
                        {goal.startDate && `${goal.startDate} 開始・`}
                        {goal.targetDate ? `目標日期 ${goal.targetDate}` : "沒有設定期限"}
                      </p>
                    </div>
                    {!selection.selecting && !achieved && (
                      <Button variant="secondary" className="shrink-0" onClick={() => setContributeId(goal.id)}>
                        ＋ 存入
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <p className={text.statValue}>
                      {formatCurrency(goal.currentAmount)}
                      <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(goal.targetAmount)}</span>
                    </p>
                    <p className={text.muted}>{achieved ? "🎉 目標達成" : `還差 ${formatCurrency(remaining)}`}</p>
                  </div>
                  <div className="mt-2">
                    <ProgressBar pct={pct} tone={achieved ? "positive" : "brand"} />
                  </div>
                  <p className={`mt-1 text-right ${text.muted}`}>{pct}%</p>

                  {pace && (
                    <p className="mt-2 rounded-xl bg-[#F9F7FE] px-3 py-2 text-xs text-[#9C94C4]">
                      距離目標還有 {pace.weeksLeft} 週（約 {pace.monthsLeft} 個月）——平均每週要存{" "}
                      <span className="font-medium text-[#4A3B7C]">{formatCurrency(pace.perWeek)}</span>，或每月存{" "}
                      <span className="font-medium text-[#4A3B7C]">{formatCurrency(pace.perMonth)}</span>
                    </p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
