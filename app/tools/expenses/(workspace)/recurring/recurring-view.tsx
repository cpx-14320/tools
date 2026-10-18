"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { text } from "@/components/expenses/theme";
import { RecurringRuleModal, type RecurringRuleModalDraft } from "@/components/expenses/recurring-rule-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot } from "@/components/expenses/selection-bar";
import { categoryById, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
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
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    setSelecting(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <div>
      <PageHeader
        title="固定收支"
        description="每月電話費、房租這種會重複出現的收支，到期會在你下次打開記帳本時自動入帳"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setSelecting((v) => !v)}>
              {selecting ? "完成" : "選取"}
            </Button>
            <Button onClick={() => setModal({ mode: "create" })}>＋ 新增固定收支</Button>
          </div>
        }
      />

      <RecurringRuleModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        categories={categories}
        goals={goals}
        defaultKind="支出"
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

      {selecting && (
        <SelectionBar
          count={selectedIds.size}
          total={rules.length}
          onToggleAll={() => setSelectedIds((set) => (set.size === rules.length ? new Set() : new Set(rules.map((r) => r.id))))}
          onCancel={() => {
            setSelecting(false);
            setSelectedIds(new Set());
          }}
          onDelete={() => setDeleteConfirm([...selectedIds])}
        />
      )}

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : rules.length === 0 ? (
        <p className={text.faint}>還沒有任何固定收支，點上方新增第一筆</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rules.map((rule) => {
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
                    {selecting ? (
                      <button type="button" onClick={() => toggleSelected(rule.id)} className="shrink-0 pt-1">
                        <SelectionDot selected={selectedIds.has(rule.id)} />
                      </button>
                    ) : (
                      <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {selecting ? (
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

                      {!selecting && (
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
