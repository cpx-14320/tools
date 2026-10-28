"use client";

import { useEffect, useState } from "react";
import { SkeletonBar, StackedCardsSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { TOAST, useToast } from "@/components/expenses/toast";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { Button, Badge, SegmentedControl } from "@/components/expenses/button";
import { IconButton } from "@/components/expenses/icon-button";
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

/** 一期已經到期、等使用者確認的固定收支（見 lib/expenses/recurring-rules.server.ts
 *  的 listPendingOccurrences）。 */
interface PendingOccurrence {
  ruleId: string;
  categoryId: string;
  amount: number;
  note?: string;
  date: string;
}

export function RecurringView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const showToast = useToast();
  const skeletonReady = useSkeletonReady();
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [rules, setRules] = useState<RecurringRuleDTO[]>([]);
  const [goals, setGoals] = useState<SavingsGoalDTO[]>([]);
  const [ready, setReady] = useState(false);
  // 載入中畫骨架，列數用上次記住的實際筆數（見 skeleton-count.ts）。
  const skeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:recurring", 4, ready ? rules.length : undefined);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  // 跟消費分類頁一樣用支出／收入分頁切換——固定收支兩種都會有（房租 vs 薪水），
  // 混在同一份清單裡要自己用金額顏色分辨，分頁之後一次只看一種。
  const [kind, setKind] = useState<CategoryKind>("支出");
  // 到期但還沒入帳的那幾期。以前是進記帳本就自動寫進交易紀錄，現在改成列在這裡等確認。
  const [pending, setPending] = useState<PendingOccurrence[]>([]);
  // 正在送出的那幾期（"ruleId|date"），避免連點送出兩次、按鈕也變成不能按。
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/recurring-rules").then((res) => res.json()),
      fetch("/api/expenses/goals").then((res) => res.json()),
      fetch("/api/expenses/recurring-rules/pending").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, rulesData, goalsData, pendingData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { rules?: RecurringRuleDTO[] },
          { goals?: SavingsGoalDTO[] },
          { pending?: PendingOccurrence[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setRules(rulesData.rules ?? []);
          setGoals(goalsData.goals ?? []);
          setPending(pendingData.pending ?? []);
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

  /** 確認或略過其中幾期。送出後伺服器會回傳新的待確認清單跟交易紀錄，直接換上。 */
  async function resolvePending(action: "confirm" | "skip", items: { ruleId: string; date: string }[]) {
    const keys = items.map((it) => `${it.ruleId}|${it.date}`);
    setBusy((set) => new Set([...set, ...keys]));
    const data: { pending?: PendingOccurrence[]; transactions?: TransactionDTO[] } = await fetch(
      "/api/expenses/recurring-rules/pending",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, items }) },
    )
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.pending) setPending(data.pending);
    if (data.transactions) setTransactions(data.transactions);
    showToast(action === "confirm" ? `已記帳 ${items.length} 筆` : `已略過 ${items.length} 筆`);
    setBusy((set) => {
      const next = new Set(set);
      for (const k of keys) next.delete(k);
      return next;
    });
  }

  /** 重抓待確認清單。
   *
   *  待確認的那幾期不是另外存起來的資料，是每次查詢時從規則現算的（見
   *  listPendingOccurrences），所以規則一改——金額、備註、起始日、頻率、期數——還沒確認
   *  的那幾期內容就跟著變，甚至整組期數都不一樣了。新增、編輯、刪除、暫停／恢復之後
   *  都要重抓，不然畫面上那張「待確認」還停在舊的金額。 */
  async function refreshPending() {
    const data: { pending?: PendingOccurrence[] } = await fetch("/api/expenses/recurring-rules/pending")
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.pending) setPending(data.pending);
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
    showToast(modal.mode === "edit" ? TOAST.saved : TOAST.created);
    setModal(null);
    await refreshPending();
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
    showToast(ids.length === 1 ? TOAST.deleted : `已刪除 ${ids.length} 筆`);
    await refreshPending();
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
    showToast(rule.active ? "已暫停" : "已恢復");
    // 暫停的規則不會再產生待確認的期數，恢復之後又會補回來。
    await refreshPending();
  }

  const today = todayISO();
  // 分類被刪掉的孤兒規則當成支出，跟 totalsForRange 對查無分類的處理方式一致。
  const visibleRules = rules.filter((r) => (categoryById(categories, r.categoryId)?.kind ?? "支出") === kind);
  const selection = useSelection(visibleRules.map((r) => r.id));

  return (
    <div>
      <PageHeader title="固定收支" help="每月電話費、房租這種會重複出現的收支。到期不會自動入帳，會列在上面的「待確認」等你按確認——金額每個月不一樣時才有機會先改或略過" />

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

      {/* 待確認：到期但還沒入帳的那幾期。排在清單最上面、而且不分支出／收入分頁——
          它是「現在要你處理的事」，被分頁藏起來等於沒有提醒到。全部處理完就整張消失。 */}
      {ready && pending.length > 0 && !selection.selecting && (
        <Card className="mb-4">
          <CardBody>
            <div className="flex items-center justify-between gap-2">
              <p className={text.sectionHeading}>待確認 {pending.length} 筆</p>
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={busy.size > 0}
                onClick={() => resolvePending("confirm", pending.map(({ ruleId, date }) => ({ ruleId, date })))}
              >
                全部確認
              </Button>
            </div>
            <p className={`mt-1 ${text.muted}`}>確認後才會寫進消費紀錄。金額跟實際不一樣的話，先略過再手動記一筆。</p>

            <div className="mt-3 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
              {pending.map((p) => {
                const category = categoryById(categories, p.categoryId);
                const isIncome = category?.kind === "收入";
                const key = `${p.ruleId}|${p.date}`;
                const isBusy = busy.has(key);
                return (
                  <div key={key} className="flex items-center gap-3 px-4 py-3">
                    <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${text.body}`}>{p.note || category?.name || "（已刪除分類）"}</p>
                      <p className={text.muted}>{p.date}</p>
                    </div>
                    <span className={`shrink-0 tabular-nums text-sm font-semibold ${isIncome ? "text-[#2FAE82]" : "text-[#4A3B7C]"}`}>
                      {isIncome ? "＋" : "－"}
                      {formatCurrency(p.amount)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => resolvePending("skip", [{ ruleId: p.ruleId, date: p.date }])}
                        className="rounded-full px-2 py-1 text-xs font-medium text-[#9C94C4] disabled:opacity-50"
                      >
                        略過
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => resolvePending("confirm", [{ ruleId: p.ruleId, date: p.date }])}
                        className="rounded-full bg-[#F3EFFC] px-3 py-1 text-xs font-medium text-[#6F5FD6] disabled:opacity-50"
                      >
                        確認
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {!skeletonReady ? null : !ready ? (
        // 一筆固定收支一張獨立的卡：左圖右文（標題＋金額一排、週期說明一排），
        // 底下還有一排循環進度。
        <StackedCardsSkeleton count={skeletonCount}>
          <div className="flex items-start gap-3">
            <div className="size-9 shrink-0 animate-pulse rounded-xl bg-[#EDE6FB]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <SkeletonBar width={96} height={14} />
                <SkeletonBar width={72} height={14} />
              </div>
              <SkeletonBar width="80%" height={12} className="mt-1.5" />
              <SkeletonBar width="55%" height={12} className="mt-1.5" />
            </div>
          </div>
        </StackedCardsSkeleton>
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
                  {/* 版面比照存錢目標那張卡：圖示＋名稱／說明垂直置中一排，鉛筆吊在右上角，
                      底下才是金額與進度。原本是「名稱可以點＝編輯」，看不出來可以改，所以
                      改成跟存錢目標一樣掛一顆明確的鉛筆。 */}
                  <div className="flex items-center gap-3">
                    {selection.selecting ? (
                      <button type="button" onClick={() => selection.toggle(rule.id)} className="shrink-0">
                        <SelectionDot selected={selection.selectedIds.has(rule.id)} />
                      </button>
                    ) : (
                      <IconAvatar icon={category?.icon ?? ""} className={category ? categoryColorClass[category.color] : undefined} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={text.sectionHeading}>{category?.name ?? "（已刪除分類）"}</span>
                        {!rule.active && <Badge>已暫停</Badge>}
                        {rule.active && finished && <Badge tone="positive">已完成</Badge>}
                      </div>
                      <p className={`mt-0.5 truncate ${text.muted}`}>
                        {describeFrequency(rule)}・{describeCycle(rule)}・{rule.startDate} ～ {endDate ?? "無限期"}
                      </p>
                      {rule.note && <p className={`mt-0.5 truncate ${text.muted}`}>{rule.note}</p>}
                    </div>

                    {/* 鉛筆＝編輯、暫停／恢復＝停掉或重啟這條規則，兩顆同一種風格排在右上角。
                        原本「暫停」是卡片最下面一顆文字鈕，跟上面的編輯入口離很遠。 */}
                    {!selection.selecting && (
                      <span className="flex shrink-0 items-center gap-1 self-start">
                        <IconButton
                          icon="pen"
                          tone="soft"
                          size={32}
                          iconSize={13}
                          aria-label={`編輯${category?.name ?? "固定收支"}`}
                          onClick={() => setModal({ mode: "edit", rule })}
                        />
                        <IconButton
                          icon={rule.active ? "pause" : "play"}
                          tone="soft"
                          size={32}
                          iconSize={13}
                          aria-label={rule.active ? `暫停${category?.name ?? "固定收支"}` : `恢復${category?.name ?? "固定收支"}`}
                          onClick={() => handleToggleActive(rule)}
                        />
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-end justify-between">
                    <p className={text.statValue}>
                      {isIncome ? "＋" : "－"}
                      {formatCurrency(rule.amount)}
                      <span className="ml-1 text-sm font-normal text-[#9C94C4]">／期</span>
                    </p>
                    <p className={text.muted}>
                      {rule.cycleCount ? `已入帳 ${confirmedCount} / ${rule.cycleCount} 期` : `已入帳 ${confirmedCount} 期`}
                    </p>
                  </div>
                  {rule.cycleCount ? (
                    <div className="mt-2">
                      <ProgressBar pct={(confirmedCount / rule.cycleCount) * 100} tone={finished ? "positive" : "brand"} />
                    </div>
                  ) : null}

                  {linkedGoal && <p className={`mt-2 ${text.muted}`}>🎯 同時存入「{linkedGoal.name}」</p>}
                  {nextDate && <p className={`mt-1 ${text.muted}`}>下次預計入帳：{nextDate}</p>}

                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
