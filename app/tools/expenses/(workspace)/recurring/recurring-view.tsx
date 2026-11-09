"use client";

import { useState } from "react";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { Badge, SegmentedControl } from "@/components/expenses/button";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { text } from "@/components/expenses/theme";
import { RecurringRuleModal, type RecurringRuleModalDraft, type RecurringRuleKind } from "@/components/expenses/recurring-rule-modal";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { categoryById, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { SavingsGoalDTO } from "@/lib/expenses/goals";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { TransferDTO } from "@/lib/expenses/transfers";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import {
  occurrenceStatuses,
  ruleEndDate,
  isRuleFinished,
  frequencyUnitLabel,
  type RecurringRuleDTO,
} from "@/lib/expenses/recurring-rules";
import { formatCurrency, formatDate } from "@/lib/format";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ModalState = { mode: "create" } | { mode: "edit"; rule: RecurringRuleDTO };

/** 一期已經到期、等使用者確認的固定收支（見 lib/expenses/recurring-rules.server.ts
 *  的 listPendingOccurrences）。 */
interface PendingOccurrence {
  ruleId: string;
  /** 轉帳類型的規則是空字串（轉帳沒有分類）。 */
  categoryId: string;
  /** 有值＝這一期確認之後會寫出一筆轉帳，不是交易。 */
  transfer?: { fromAccountId: string; toAccountId: string; fee?: number };
  amount: number;
  note?: string;
  date: string;
}

/** 固定收支頁。資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，
 *  也不需要骨架。 */
export function RecurringView({
  initialCategories,
  initialTransactions,
  initialRules,
  /** 轉帳類型的規則要選轉出／轉入帳戶，列表上也要顯示帳戶名稱。 */
  accounts,
  accountTypes,
  /** 算「轉帳類型的規則已經入帳幾期」要用（那種規則入帳成的是轉帳，不是交易）。 */
  transfers: initialTransfers,
  /** 規則可以綁一個存錢目標，只拿來顯示目標名稱。目標是在存錢目標那一頁改的，這一頁
   *  只讀，所以不用放進 state。 */
  goals,
  initialPending,
}: {
  initialCategories: CategoryDTO[];
  initialTransactions: TransactionDTO[];
  initialRules: RecurringRuleDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transfers: TransferDTO[];
  goals: SavingsGoalDTO[];
  initialPending: PendingOccurrence[];
}) {
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const showToast = useToast();
  const showDeleteToast = useUndoDelete();
  const [transactions, setTransactions] = useState<TransactionDTO[]>(initialTransactions);
  // 轉帳類型的規則入帳成的是轉帳，確認之後要跟著更新才算得出新的「已入帳幾期」。
  const [transfers, setTransfers] = useState<TransferDTO[]>(initialTransfers);
  const [rules, setRules] = useState<RecurringRuleDTO[]>(initialRules);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  // 待確認預設只顯示前幾筆：一條週期規則積上半年就是二三十筆，整張攤開會把下面的規則
  // 清單整個推到第二屏，變成「進來只看得到待確認」。
  const [pendingExpanded, setPendingExpanded] = useState(false);
  // 跟消費分類頁一樣用支出／收入分頁切換——固定收支兩種都會有（房租 vs 薪水），
  // 混在同一份清單裡要自己用金額顏色分辨，分頁之後一次只看一種。
  const [kind, setKind] = useState<RecurringRuleKind>("支出");
  // 待確認列表的勾選（跟底下規則清單的多選是兩回事，所以各自一份狀態）。
  // key 是 `ruleId|date`——同一條規則會有好幾期待確認，光靠 ruleId 分不出是哪一期。
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set());
  const togglePending = (key: string) =>
    setPendingSelected((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // 到期但還沒入帳的那幾期。以前是進記帳本就自動寫進交易紀錄，現在改成列在這裡等確認。
  const [pending, setPending] = useState<PendingOccurrence[]>(initialPending);
  // 正在送出的那幾期（"ruleId|date"），避免連點送出兩次、按鈕也變成不能按。
  const [busy, setBusy] = useState<Set<string>>(new Set());

  /** 確認或略過其中幾期。送出後伺服器會回傳新的待確認清單跟交易紀錄，直接換上。 */
  async function resolvePending(action: "confirm" | "skip", items: { ruleId: string; date: string }[]) {
    const keys = items.map((it) => `${it.ruleId}|${it.date}`);
    setBusy((set) => new Set([...set, ...keys]));
    const data: { pending?: PendingOccurrence[]; transactions?: TransactionDTO[]; transfers?: TransferDTO[] } = await fetch(
      "/api/expenses/recurring-rules/pending",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, items }) },
    )
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.pending) setPending(data.pending);
    if (data.transactions) setTransactions(data.transactions);
    if (data.transfers) setTransfers(data.transfers);
    // 處理完把勾選清掉：那幾期已經不在待確認清單裡了，留著只會讓上面的數字對不上。
    setPendingSelected(new Set());
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
    const trashIds: (string | undefined)[] = [];
    for (const id of ids) {
      const data: { rules?: RecurringRuleDTO[]; trashId?: string } = await fetch(`/api/expenses/recurring-rules?id=${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.rules) latest = data.rules;
      trashIds.push(data.trashId);
    }
    setRules(latest);
    showDeleteToast(
      trashIds,
      async () => {
        const fresh: { rules?: RecurringRuleDTO[] } = await fetch("/api/expenses/recurring-rules").then((r) => r.json());
        if (fresh.rules) setRules(fresh.rules);
        await refreshPending();
      },
      ids.length === 1 ? TOAST.deleted : `已刪除 ${ids.length} 筆`,
    );
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
  // 轉帳規則沒有分類，所以不能靠分類的收支方向分頁——它們只出現在「轉帳」那一頁。
  const ruleKind = (r: { categoryId: string; transfer?: unknown }): RecurringRuleKind =>
    r.transfer ? "轉帳" : (categoryById(categories, r.categoryId)?.kind ?? "支出");
  const visibleRules = rules.filter((r) => ruleKind(r) === kind);
  // 待確認也跟著分頁篩，判斷方式跟上面一致（查無分類一律當支出）。
  const visiblePending = pending.filter((p) => ruleKind(p) === kind);
  // 收合只影響「列出幾筆」，不影響上面的筆數跟「全部確認／全部略過」——那兩顆處理的
  // 一律是這個分頁底下全部的待確認，不是畫面上看得到的那幾筆。
  const shownPending = pendingExpanded ? visiblePending : visiblePending.slice(0, PREVIEW_COUNT);

  /** 上面那兩顆按鈕要處理哪幾期：有勾就只處理勾起來的，沒勾就是這個分頁底下的全部
   *  （不是畫面上看得到的那幾筆——收合只影響列出幾筆）。 */
  function targetPending() {
    const chosen = pendingSelected.size > 0 ? visiblePending.filter((p) => pendingSelected.has(`${p.ruleId}|${p.date}`)) : visiblePending;
    return chosen.map(({ ruleId, date }) => ({ ruleId, date }));
  }
  /** 一條規則（或一期待確認）在清單上長什麼樣。
   *
   *  轉帳沒有分類，所以圖示、名稱、金額的正負號都不能從分類來：圖示用轉帳那張圖，
   *  名稱沒寫備註時退回「玉山銀行 → 台新銀行」這種方向描述（比單寫「轉帳」有用得多，
   *  一次設好幾條轉帳規則時才分得出哪條是哪條），金額不帶正負號——轉帳不是支出也不是
   *  收入，標上「－」會讓人以為那個月多花了這筆錢。 */
  function describeRow(row: { categoryId: string; transfer?: { fromAccountId: string; toAccountId: string } }) {
    if (row.transfer) {
      const from = accounts.find((a) => a.id === row.transfer!.fromAccountId)?.name ?? "（已刪除帳戶）";
      const to = accounts.find((a) => a.id === row.transfer!.toAccountId)?.name ?? "（已刪除帳戶）";
      return { icon: ICON_PATHS.accountTransfer, colorClass: undefined, name: `${from} → ${to}`, sign: "" as const, income: false };
    }
    const category = categoryById(categories, row.categoryId);
    const income = category?.kind === "收入";
    return {
      icon: category?.icon ?? "",
      colorClass: category ? categoryColorClass[category.color] : undefined,
      name: category?.name ?? "（已刪除分類）",
      sign: income ? ("＋" as const) : ("－" as const),
      income,
    };
  }

  const selection = useSelection(visibleRules.map((r) => r.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader flush title="固定收支" help="房租、電話費這種每期重複的收支。到期不會自動入帳，而是列進「待確認」等你確認——金額每期不同時可以先改再確認，這期不想記就略過" />

      {/* 新增搬到右下角的浮動按鈕，跟首頁新增交易、消費分類頁同一招。 */}
      {/* 等資料回來才出現：它是 fixed、不佔版面，所以不需要骨架，但資料還沒回來就先浮在
          一片灰條上面很突兀（跟首頁、資產總表同一個處理）。 */}
      <FloatingAddButton onClick={() => setModal({ mode: "create" })} label="新增固定收支" />

      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
            { value: "轉帳", label: "轉帳" },
          ]}
        />
        <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />
      </div>

      <RecurringRuleModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        goals={goals}
        defaultKind={kind}
        initial={
          modal?.mode === "edit"
            ? {
                categoryId: modal.rule.categoryId,
                transfer: modal.rule.transfer,
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
        confirmedDates={
          modal?.mode === "edit" ? transactions.filter((t) => t.sourceRuleId === modal.rule.id).map((t) => t.date) : undefined
        }
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? requestDelete : undefined}
        onCategoriesChange={setCategories}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="確定要刪除固定收支嗎？"
        message={`刪除後這${(deleteConfirm?.length ?? 0) > 1 ? ` ${deleteConfirm?.length} 條` : "條"}規則不會再自動入帳，但已經入帳過的交易紀錄不會被刪除，會繼續留著。${TRASH_RESTORE_NOTE}`}
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

      {/* 待確認：到期但還沒入帳的那幾期。排在清單最上面，而且跟著支出／收入分頁一起篩
          ——本來是刻意不分頁的（「現在要你處理的事」不該被藏起來），但那造成切到收入時
          上面列著電話費、下面的清單卻空了，看起來像資料不見了。現在整頁講的是同一種
          收支，兩邊才對得起來；另一邊有待確認的話，切過去就看得到。 */}
      {visiblePending.length > 0 && !selection.selecting && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-2">
              <p className={text.sectionHeading}>待確認 {visiblePending.length} 筆</p>
              {/* 上面這兩顆是唯一的操作入口：沒勾任何一列就處理全部，勾了就只處理勾起來
                  的那幾筆（按鈕文字跟著變）。每一列原本各有一組「略過／確認」，一列兩顆
                  小按鈕在手機上很容易按錯，而且十幾列就等於畫面上有二三十顆按鈕。 */}
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={busy.size > 0}
                  onClick={() => resolvePending("skip", targetPending())}
                  className="rounded-full px-3 py-1 text-xs font-medium text-[#9C94C4] disabled:opacity-50"
                >
                  {pendingSelected.size > 0 ? `略過 ${pendingSelected.size} 筆` : "全部略過"}
                </button>
                <button
                  type="button"
                  disabled={busy.size > 0}
                  onClick={() => resolvePending("confirm", targetPending())}
                  className="rounded-full bg-[#F3EFFC] px-3 py-1 text-xs font-medium text-[#6F5FD6] disabled:opacity-50"
                >
                  {pendingSelected.size > 0 ? `確認 ${pendingSelected.size} 筆` : "全部確認"}
                </button>
              </span>
            </div>
            <p className={`mt-1 ${text.muted}`}>
              {pendingSelected.size > 0
                ? "只會處理勾起來的那幾筆。"
                : "確認後才會寫進消費紀錄；沒有勾選時，上面兩顆處理的是全部。"}
            </p>

            <div className="mt-3 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
              {shownPending.map((p) => {
                const row = describeRow(p);
                const key = `${p.ruleId}|${p.date}`;
                const isBusy = busy.has(key);
                return (
                  // 整列就是勾選目標（跟明細頁的多選同一種操作方式）：圓點只有 20px，
                  // 做成唯一可點的區域在手機上很容易點歪。
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={pendingSelected.has(key)}
                    disabled={isBusy}
                    onClick={() => togglePending(key)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-50 active:bg-[#F3EFFC]"
                  >
                    <SelectionDot selected={pendingSelected.has(key)} />
                    <IconAvatar icon={row.icon} className={row.colorClass} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${text.body}`}>{p.note || row.name}</p>
                      <p className={text.muted}>
                        {formatDate(p.date)}
                        {/* 有備註時方向會被備註蓋掉，補在日期旁邊——不然看不出這期要從哪個
                            戶頭轉到哪個戶頭。手續費也一起講，那是會被扣掉的錢。 */}
                        {p.transfer && p.note ? ` · ${row.name}` : ""}
                        {p.transfer?.fee ? ` · 手續費 ${formatCurrency(p.transfer.fee)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 tabular-nums text-sm font-semibold ${row.income ? "text-[#2FAE82]" : "text-[#4A3B7C]"}`}>
                      {row.sign}
                      {formatCurrency(p.amount)}
                    </span>
                  </button>
                );
              })}
            </div>

            {visiblePending.length > PREVIEW_COUNT && (
              <ExpandToggle
                expanded={pendingExpanded}
                total={visiblePending.length}
                onToggle={() => setPendingExpanded((v) => !v)}
              />
            )}
          </CardBody>
        </Card>
      )}

      {visibleRules.length === 0 ? (
        <p className={text.faint}>還沒有任何固定{kind}，點右下角的＋新增第一筆</p>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRules.map((rule) => {
            const row = describeRow(rule);
            const linkedGoal = rule.linkedGoalId ? goals.find((g) => g.id === rule.linkedGoalId) : undefined;
            // 轉帳規則入帳成的是轉帳、不是交易，所以要從 transfers 那邊比對已入帳的期數
            // （不然每一條轉帳規則的進度都會停在 0）。
            const confirmedByDate = rule.transfer
              ? new Map(transfers.filter((t) => t.sourceRuleId === rule.id).map((t) => [t.date, t.id] as const))
              : new Map(transactions.filter((t) => t.sourceRuleId === rule.id).map((t) => [t.date, t.id] as const));
            const statuses = occurrenceStatuses(rule, confirmedByDate, today);
            const confirmedCount = statuses.filter((s) => s.confirmed).length;
            const endDate = ruleEndDate(rule);
            const finished = isRuleFinished(rule, today);

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
                      <IconAvatar icon={row.icon} className={row.colorClass} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={text.sectionHeading}>{row.name}</span>
                        {!rule.active && <Badge>已暫停</Badge>}
                        {rule.active && finished && <Badge tone="positive">已完成</Badge>}
                      </div>
                      {rule.note && <p className={`mt-0.5 truncate ${text.muted}`}>{rule.note}</p>}
                    </div>

                    {/* 鉛筆＝編輯、暫停／恢復＝停掉或重啟這條規則，兩顆同一種風格排在右上角。
                        原本「暫停」是卡片最下面一顆文字鈕，跟上面的編輯入口離很遠。 */}
                    {!selection.selecting && (
                      <span className="flex shrink-0 items-center gap-1 self-start">
                        {/* 線條風格（LineIconButton），跟首頁的眼睛、日期旁邊的日曆同一組：
                            Font Awesome 的實心圖縮到 13px 會又黑又重，在一張以文字為主的
                            卡片右上角比卡片本身還搶眼。 */}
                        <LineIconButton
                          icon="pen"
                          aria-label={`編輯${row.name}`}
                          onClick={() => setModal({ mode: "edit", rule })}
                        />
                        <LineIconButton
                          icon={rule.active ? "pause" : "play"}
                          aria-label={rule.active ? `暫停${row.name}` : `恢復${row.name}`}
                          onClick={() => handleToggleActive(rule)}
                        />
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-end justify-between">
                    <p className={text.statValue}>
                      {/* 轉帳規則不帶正負號（describeRow 的 sign 是空字串）：錢只是從
                          一個戶頭搬到另一個，標上「－」會讓人以為那個月多花了這筆。 */}
                      {row.sign}
                      {formatCurrency(rule.amount)}
                      <span className="ml-1 text-sm font-normal text-[#9C94C4]">／期</span>
                      {/* 手續費才是真的花掉的錢，補在金額後面——卡片上看不到的話，使用者
                          會以為這條規則每期只動 5,000。 */}
                      {rule.transfer?.fee ? (
                        <span className="ml-1 text-sm font-normal text-[#9C94C4]">＋手續費 {formatCurrency(rule.transfer.fee)}</span>
                      ) : null}
                    </p>
                    {/* 期數後面補上頻率單位（期（月）／期（2 週）），原本那行獨立的
                        「每月・循環 24 期・起～訖」就不用了——同樣的資訊攤成一整行、
                        而且太長還會被截斷，最重要的結束日正好被切掉。 */}
                    <p className={text.muted}>
                      {rule.cycleCount
                        ? `已入帳 ${confirmedCount} / ${rule.cycleCount} 期（${frequencyUnitLabel(rule)}）`
                        : `已入帳 ${confirmedCount} 期（${frequencyUnitLabel(rule)}）`}
                    </p>
                  </div>
                  {rule.cycleCount ? (
                    <div className="mt-2">
                      <ProgressBar pct={(confirmedCount / rule.cycleCount) * 100} tone={finished ? "positive" : "brand"} />
                    </div>
                  ) : null}

                  {linkedGoal && <p className={`mt-2 ${text.muted}`}>🎯 同時存入「{linkedGoal.name}」</p>}
                  {/* 這一塊從「下次預計入帳」換成整條規則的起訖區間：下次入帳日是算得出來
                      的細節，真正會想確認的是「這筆扣到什麼時候為止」。靠右對齊，跟上面
                      那行期數同一個右邊界。 */}
                  <p className={`mt-1 text-right ${text.muted}`}>
                    {formatDate(rule.startDate)} ～ {endDate ? formatDate(endDate) : "無限期"}
                  </p>

                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
