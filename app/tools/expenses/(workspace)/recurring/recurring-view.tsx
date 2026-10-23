"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { Button, Badge, SegmentedControl } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { text } from "@/components/expenses/theme";
import { RecurringRuleModal, type RecurringRuleModalDraft } from "@/components/expenses/recurring-rule-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { categoryById, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { SavingsGoalDTO } from "@/lib/expenses/goals";
import {
  occurrenceStatuses,
  ruleEndDate,
  isRuleFinished,
  describeFrequency,
  describeCycle,
  nextOccurrenceDate,
  type RecurringRuleDTO,
} from "@/lib/expenses/recurring-rules";
import { formatCurrency } from "@/lib/format";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ModalState = { mode: "create" } | { mode: "edit"; rule: RecurringRuleDTO };

export function RecurringView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [rules, setRules] = useState<RecurringRuleDTO[]>([]);
  const [goals, setGoals] = useState<SavingsGoalDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  // 跟消費分類頁一樣用支出／收入分頁切換——固定收支兩種都會有（房租 vs 薪水），
  // 混在同一份清單裡要自己用金額顏色分辨，分頁之後一次只看一種。
  const [kind, setKind] = useState<CategoryKind>("支出");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/recurring-rules").then((res) => res.json()),
      fetch("/api/expenses/goals").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, rulesData, goalsData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { rules?: RecurringRuleDTO[] },
          { goals?: SavingsGoalDTO[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setRules(rulesData.rules ?? []);
          setGoals(goalsData.goals ?? []);
          setReady(true);
        },
      )
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: RecurringRuleModalDraft) {
    if (!modal) return;
    const method = modal.mode === "edit" ? "PUT" : "POST";
    const body = modal.mode === "edit" ? { id: modal.rule.id, ...draft } : draft;
    const data: { rules?: RecurringRuleDTO[] } = await fetch("/api/expenses/recurring-rules", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
    setModal(null);
  }

  async function performDelete(ids: string[]) {
    let latest = rules;
    for (const id of ids) {
      const data: { rules?: RecurringRuleDTO[] } = await fetch(`/api/expenses/recurring-rules?id=${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.rules) latest = data.rules;
    }
    setRules(latest);
  }

  function requestDelete() {
    if (modal?.mode !== "edit") return;
    setModal(null);
    setDeleteConfirm([modal.rule.id]);
  }

  async function handleConfirmedDelete() {
    if (!deleteConfirm) return;
    await performDelete(deleteConfirm);
    setDeleteConfirm(null);
    selection.exit();
  }

  async function handleToggleActive(rule: RecurringRuleDTO) {
    const data: { rules?: RecurringRuleDTO[] } = await fetch("/api/expenses/recurring-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, active: !rule.active }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
  }

  const today = todayISO();
  // 分類被刪掉的孤兒規則當成支出，跟 totalsForRange 對查無分類的處理方式一致。
  const visibleRules = rules.filter((r) => (categoryById(categories, r.categoryId)?.kind ?? "支出") === kind);
  const selection = useSelection(visibleRules.map((r) => r.id));

  return (
    <div>
      <PageHeader title="固定收支" help="每月電話費、房租這種會重複出現的收支，到期會在你下次打開記帳本時自動入帳" />

      {/* 新增搬到右下角的浮動按鈕，跟首頁新增交易、消費分類頁同一招。 */}
      <FloatingAddButton onClick={() => setModal({ mode: "create" })} label="新增固定收支" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
        <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />
      </div>

      <RecurringRuleModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        categories={categories}
        goals={goals}
        defaultKind={kind}
        initial={
          modal?.mode === "edit"
            ? {
                categoryId: modal.rule.categoryId,
                amount: modal.rule.amount,
                note: modal.rule.note,
                frequencyUnit: modal.rule.frequencyUnit,
                interval: modal.rule.interval,
                startDate: modal.rule.startDate,
                cycleCount: modal.rule.cycleCount,
                linkedGoalId: modal.rule.linkedGoalId,
              }
            : undefined
        }
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? requestDelete : undefined}
        onCategoriesChange={setCategories}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="確定要刪除固定收支嗎？"
        message={`刪除後這${(deleteConfirm?.length ?? 0) > 1 ? ` ${deleteConfirm?.length} 條` : "條"}規則不會再自動入帳，但已經入帳過的交易紀錄不會被刪除，會繼續留著。`}
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
      ) : visibleRules.length === 0 ? (
        <p className={text.faint}>還沒有任何固定{kind}，點右下角的＋新增第一筆</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRules.map((rule) => {
            const category = categoryById(categories, rule.categoryId);
            const linkedGoal = rule.linkedGoalId ? goals.find((g) => g.id === rule.linkedGoalId) : undefined;
            const confirmedByDate = new Map(
              transactions.filter((t) => t.sourceRuleId === rule.id).map((t) => [t.date, t.id] as const),
            );
            const statuses = occurrenceStatuses(rule, confirmedByDate, today);
            const confirmedCount = statuses.filter((s) => s.confirmed).length;
            const nextDate = rule.active ? nextOccurrenceDate(rule, confirmedCount) : null;
            const endDate = ruleEndDate(rule);
            const finished = isRuleFinished(rule, today);
            const isIncome = category?.kind === "收入";

            return (
              <Card key={rule.id}>
                <CardBody>
                  {/* 左圖右文：圖示固定在左邊，標題／金額／週期說明／進度／下次入帳全部都在
                      右邊這一欄裡，文字左緣才會通通對齊。金額跟標題擺在同一列（不是跟整個
                      文字區塊並排），下面那行「每月・無限期循環・起訖」就能吃滿整欄寬度、
                      不會被金額擠到換行。 */}
                  <div className="flex items-start gap-3">
                    {selection.selecting ? (
                      <button type="button" onClick={() => selection.toggle(rule.id)} className="shrink-0 pt-1">
                        <SelectionDot selected={selection.selectedIds.has(rule.id)} />
                      </button>
                    ) : (
                      <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {selection.selecting ? (
                            <span className={text.sectionHeading}>{category?.name ?? "（已刪除分類）"}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModal({ mode: "edit", rule })}
                              className={`${text.sectionHeading} hover:underline`}
                            >
                              {category?.name ?? "（已刪除分類）"}
                            </button>
                          )}
                          {!rule.active && <Badge>已暫停</Badge>}
                          {rule.active && finished && <Badge tone="positive">已完成</Badge>}
                        </div>
                        <span className={`shrink-0 tabular-nums font-semibold text-[#4A3B7C] ${isIncome ? "text-[#2FAE82]" : ""}`}>
                          {isIncome ? "＋" : "－"}
                          {formatCurrency(rule.amount)}
                          <span className={`ml-1 font-normal ${text.muted}`}>／期</span>
                        </span>
                      </div>

                      {rule.note && <p className={`mt-0.5 ${text.muted}`}>{rule.note}</p>}
                      <p className={`mt-0.5 truncate ${text.muted}`}>
                        {describeFrequency(rule)}・{describeCycle(rule)}・{rule.startDate} ～ {endDate ?? "無限期"}
                      </p>
                      {linkedGoal && <p className={`mt-0.5 ${text.muted}`}>🎯 同時存入「{linkedGoal.name}」</p>}

                      {rule.cycleCount ? (
                        <div className="mt-3">
                          <p className={text.statValue}>
                            {confirmedCount}
                            <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {rule.cycleCount} 期已入帳</span>
                          </p>
                          <div className="mt-2">
                            <ProgressBar pct={(confirmedCount / rule.cycleCount) * 100} tone={finished ? "positive" : "brand"} />
                          </div>
                        </div>
                      ) : (
                        <p className={`mt-2 ${text.muted}`}>已入帳 {confirmedCount} 期（無限期循環）</p>
                      )}

                      {nextDate && <p className={`mt-1 ${text.muted}`}>下次預計入帳：{nextDate}</p>}

                      {!selection.selecting && (
                        <div className="mt-2 flex items-center justify-end">
                          <Button variant="ghost" onClick={() => handleToggleActive(rule)}>
                            {rule.active ? "暫停" : "恢復"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
