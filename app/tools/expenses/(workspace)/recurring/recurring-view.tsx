"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { text } from "@/components/expenses/theme";
import { RecurringRuleModal, type RecurringRuleModalDraft } from "@/components/expenses/recurring-rule-modal";
import { categoryById, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import {
  occurrenceStatuses,
  ruleEndDate,
  isRuleFinished,
  describeFrequency,
  describeCycle,
  nextPendingOccurrence,
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
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/recurring-rules").then((res) => res.json()),
    ])
      .then(([categoriesData, txData, rulesData]: [{ categories?: CategoryDTO[] }, { transactions?: TransactionDTO[] }, { rules?: RecurringRuleDTO[] }]) => {
        if (cancelled) return;
        setCategories(categoriesData.categories ?? []);
        setTransactions(txData.transactions ?? []);
        setRules(rulesData.rules ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 確認存入之後，規則清單本身不會變，但「哪幾期已存入」要靠重新抓一次交易紀錄才知道
   *  ——固定收支沒有自己另外存一份「已確認期數」，完全是跟 expenses.transactions 比對出來的
   *  （見 lib/expenses/recurring-rules.ts 開頭的說明）。 */
  async function refetchTransactions() {
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions")
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
  }

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

  async function handleDelete() {
    if (modal?.mode !== "edit") return;
    const data: { rules?: RecurringRuleDTO[] } = await fetch(`/api/expenses/recurring-rules?id=${modal.rule.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
    setModal(null);
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

  async function handleConfirm(rule: RecurringRuleDTO, occurrenceDate: string) {
    setConfirmingId(rule.id);
    const data: { rules?: RecurringRuleDTO[]; error?: string } = await fetch("/api/expenses/recurring-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rule.id, confirmDate: occurrenceDate }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
    await refetchTransactions();
    setConfirmingId(null);
  }

  const today = todayISO();

  return (
    <div>
      <PageHeader
        title="固定收支"
        description="每月電話費、房租這種會重複出現的收支，排好週期，到期時手動確認存入才會真正計入"
        actions={<Button onClick={() => setModal({ mode: "create" })}>＋ 新增固定收支</Button>}
      />

      <RecurringRuleModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        categories={categories}
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
              }
            : undefined
        }
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? handleDelete : undefined}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : rules.length === 0 ? (
        <p className={text.faint}>還沒有任何固定收支，點上方新增第一筆</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rules.map((rule) => {
            const category = categoryById(categories, rule.categoryId);
            const confirmedByDate = new Map(
              transactions.filter((t) => t.sourceRuleId === rule.id).map((t) => [t.date, t.id] as const),
            );
            const statuses = occurrenceStatuses(rule, confirmedByDate, today);
            const confirmedCount = statuses.filter((s) => s.confirmed).length;
            const pending = nextPendingOccurrence(statuses);
            const endDate = ruleEndDate(rule);
            const finished = isRuleFinished(rule, today);
            const isIncome = category?.kind === "收入";

            return (
              <Card key={rule.id}>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setModal({ mode: "edit", rule })} className={`${text.sectionHeading} hover:underline`}>
                          {category?.name ?? "（已刪除分類）"}
                        </button>
                        {!rule.active && <Badge>已暫停</Badge>}
                        {rule.active && finished && <Badge tone="positive">已完成</Badge>}
                      </div>
                      {rule.note && <p className={`mt-0.5 ${text.muted}`}>{rule.note}</p>}
                      <p className={`mt-0.5 ${text.muted}`}>
                        {describeFrequency(rule)}・{describeCycle(rule)}・{rule.startDate} ～ {endDate ?? "無限期"}
                      </p>
                    </div>
                    <span className={`shrink-0 tabular-nums font-semibold text-[#4A3B7C] ${isIncome ? "text-[#2FAE82]" : ""}`}>
                      {isIncome ? "＋" : ""}
                      {formatCurrency(rule.amount)}
                      <span className={`ml-1 font-normal ${text.muted}`}>／期</span>
                    </span>
                  </div>

                  {rule.cycleCount ? (
                    <div className="mt-4">
                      <div className="flex items-end justify-between">
                        <p className={text.statValue}>
                          {confirmedCount}
                          <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {rule.cycleCount} 期已存入</span>
                        </p>
                      </div>
                      <div className="mt-2">
                        <ProgressBar pct={(confirmedCount / rule.cycleCount) * 100} tone={finished ? "positive" : "brand"} />
                      </div>
                    </div>
                  ) : (
                    <p className={`mt-3 ${text.muted}`}>已存入 {confirmedCount} 期（無限期循環）</p>
                  )}

                  {pending && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F9F7FE] px-3 py-2.5">
                      <p className="text-xs text-[#9C94C4]">
                        本期應存（{pending.date}）
                        <span className="ml-1 font-medium text-[#4A3B7C]">{formatCurrency(rule.amount)}</span>，還沒存入
                      </p>
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        disabled={confirmingId === rule.id}
                        onClick={() => handleConfirm(rule, pending.date)}
                      >
                        確認存入
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button variant="ghost" onClick={() => handleToggleActive(rule)}>
                      {rule.active ? "暫停" : "恢復"}
                    </Button>
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
