"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/expenses/page-header";
import { IconButton } from "@/components/expenses/button";
import { BackLink } from "@/components/expenses/back-link";
import { Card, CardBody } from "@/components/expenses/card";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { IconAvatar, InlineIcon } from "@/components/expenses/icon-avatar";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { KpiCard, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { ComparePicker } from "@/components/expenses/compare-picker";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { ReconcileModal } from "@/components/expenses/reconcile-modal";
import { BreakdownToggle, TransactionBreakdown } from "@/components/expenses/transaction-breakdown";
import { compareDateFilter, compareLabel, dateFilterRange } from "@/lib/expenses/date-filter";
import { categoryById, categoryColorClass, categoryPath, type CategoryDTO } from "@/lib/expenses/categories";
import { totalsForRange, rangeDelta, transactionsInDateRange, transactionDisplayName, type TransactionDTO } from "@/lib/expenses/transactions";
import { inDateRange } from "@/lib/expenses/date-filter";
import { accountBalance, transactionBalancesByAccount, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { transfersForAccount, type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

type TxModalState = { mode: "create" } | { mode: "edit"; transaction: TransactionDTO };

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { filter, compare } = useDateFilter();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  // 掛載時算一次固定住——在 render 當中讀時鐘是不純的。
  const [todayISO] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [txModal, setTxModal] = useState<TxModalState | null>(null);
  const [transferModal, setTransferModal] = useState<TransferDTO | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ inUseCount: number } | null>(null);
  // 哪幾筆的明細是展開的——預設全部收起來，只有有明細的那幾筆才看得到展開箭頭。
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
    ])
      .then(
        ([accountsData, accountTypesData, categoriesData, txData, transfersData]: [
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { transfers?: TransferDTO[] },
        ]) => {
          if (cancelled) return;
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setTransfers(transfersData.transfers ?? []);
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

  const account = accounts.find((a) => a.id === accountId);

  async function handleEditSave(draft: AccountModalDraft) {
    const data: { accounts?: AccountDTO[] } = await fetch("/api/expenses/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accounts) setAccounts(data.accounts);
    setEditOpen(false);
  }

  async function handleEditDelete() {
    const res = await fetch(`/api/expenses/accounts?id=${accountId}`, { method: "DELETE" }).catch(() => null);
    if (res?.status === 409) {
      const data: { inUseCount?: number } = await res.json().catch(() => ({}));
      setEditOpen(false);
      setDeleteConfirm({ inUseCount: data.inUseCount ?? 0 });
      return;
    }
    router.push("/tools/expenses/assets");
  }

  async function handleForceDeleteAccount() {
    await fetch(`/api/expenses/accounts?id=${accountId}&force=1`, { method: "DELETE" }).catch(() => {});
    router.push("/tools/expenses/assets");
  }

  async function handleTxSave(draft: TransactionModalDraft) {
    if (!txModal) return;
    const method = txModal.mode === "edit" ? "PUT" : "POST";
    const body = txModal.mode === "edit" ? { id: txModal.transaction.id, ...draft } : { ...draft, accountId };
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setTxModal(null);
  }

  // 對帳補的就是一般的交易，只是金額跟分類是對帳彈窗算好的，一律掛在這個帳戶上。
  async function handleReconcile(draft: { categoryId: string; amount: number; date: string; note: string }) {
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, accountId }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setReconcileOpen(false);
  }

  async function handleTxDelete() {
    if (txModal?.mode !== "edit") return;
    const data: { transactions?: TransactionDTO[] } = await fetch(`/api/expenses/transactions?id=${txModal.transaction.id}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setTxModal(null);
  }

  async function handleTransferSave(draft: TransferModalDraft) {
    if (!transferModal) return;
    const data: { transfers?: TransferDTO[] } = await fetch("/api/expenses/transfers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: transferModal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transfers) setTransfers(data.transfers);
    setTransferModal(null);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTransferDelete() {
    if (!transferModal) return;
    const data: { transfers?: TransferDTO[] } = await fetch(`/api/expenses/transfers?id=${transferModal.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transfers) setTransfers(data.transfers);
    setTransferModal(null);
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/tools/expenses/assets" label="返回資產總表" />
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/tools/expenses/assets" label="返回資產總表" />
        <p className={text.faint}>找不到這個帳戶，可能已經被刪除</p>
      </div>
    );
  }

  const type = accountTypeById(accountTypes, account.accountTypeId);
  const accountTx = transactions.filter((t) => t.accountId === account.id);
  const range = dateFilterRange(filter);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(accountTx, r).length > 0;

  // 「跟誰比」由使用者選的比較基準決定，徽章後綴也跟著換（vs 上期／vs 去年同期…）。
  const baseline = compareDateFilter(filter, compare);
  const deltaSuffix = compareLabel(filter, compare);
  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(accountTx, categories, range);
  const incomeDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).totalIncome, filter, hasPriorData, baseline);
  const expenseDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).totalExpense, filter, hasPriorData, baseline);
  const balanceDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).balance, filter, hasPriorData, baseline);

  const accountTransfers = transfersForAccount(transfers, account.id).filter((t) => inDateRange(t.date, range));

  // 「明細」要把一般交易跟轉帳混在同一個依日期分組的列表裡——轉帳不是支出也不是收入，
  // 不算進上面的 KPI 統計，但使用者翻帳戶明細時仍然要看得到錢是什麼時候被轉走/轉進來的。
  type DetailEntry = { date: string } & ({ kind: "tx"; tx: TransactionDTO } | { kind: "transfer"; transfer: TransferDTO });
  const entries: DetailEntry[] = [
    ...[...expenseTx, ...incomeTx].map((tx): DetailEntry => ({ kind: "tx", date: tx.date, tx })),
    ...accountTransfers.map((transfer): DetailEntry => ({ kind: "transfer", date: transfer.date, transfer })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = new Map<string, DetailEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  }

  const kind = accountTypeById(accountTypes, account.accountTypeId)?.kind ?? "asset";
  const currentBalance = accountBalance(account, accountTypes, transactions, categories, transfers);
  // 每一筆交易／轉帳「發生後」這個帳戶變成多少——跟上面的日期篩選器無關，一律用全部
  // 資料算，不然篩選器切到別的區間時，顯示出來的「交易後餘額」會跟著篩選範圍錯亂。
  const accountBalances = transactionBalancesByAccount(accounts, accountTypes, transactions, categories, transfers);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={account.name}
        description={
          type ? (
            <span className="flex items-center gap-1.5">
              <InlineIcon icon={type.icon} />
              {type.name}
            </span>
          ) : (
            "（未知類型）"
          )
        }
        actions={
          <div className="flex items-center gap-2">
            <IconButton aria-label="編輯帳戶資料" onClick={() => setEditOpen(true)}>
              ✏️
            </IconButton>
            <BackLink href="/tools/expenses/assets" label="返回資產總表" />
          </div>
        }
      />

      <AccountModal
        open={editOpen}
        accounts={accounts}
        accountTypes={accountTypes}
        initial={{ name: account.name, accountTypeId: account.accountTypeId, openingBalance: account.openingBalance }}
        excludeId={accountId}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
        onAccountTypesChange={setAccountTypes}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="這個帳戶還有紀錄"
        message={`這個帳戶還有 ${deleteConfirm?.inUseCount ?? 0} 筆交易或轉帳紀錄，刪除後這些紀錄會變成「不指定帳戶」，但不會被刪除。確定要刪除這個帳戶嗎？`}
        onConfirm={handleForceDeleteAccount}
        onClose={() => setDeleteConfirm(null)}
      />

      <TransactionModal
        key={txModal ? JSON.stringify(txModal) : "closed"}
        open={txModal !== null}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind="支出"
        initial={txModal?.mode === "edit" ? txModal.transaction : undefined}
        onClose={() => setTxModal(null)}
        onSave={handleTxSave}
        onDelete={txModal?.mode === "edit" ? handleTxDelete : undefined}
        onCategoriesChange={setCategories}
      />

      <TransferModal
        key={transferModal ? transferModal.id : "closed"}
        open={transferModal !== null}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        initial={transferModal ?? undefined}
        onClose={() => setTransferModal(null)}
        onSave={handleTransferSave}
        onDelete={handleTransferDelete}
      />

      <Card>
        <CardBody className="py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className={text.muted}>目前{kind === "liability" ? "欠款" : "餘額"}</p>
              <p className={`mt-0.5 text-2xl font-bold tabular-nums ${kind === "liability" ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>
                {formatCurrency(currentBalance)}
              </p>
            </div>
            <IconAvatar icon={type?.icon ?? "❓"} />
          </div>
          {/* 餘額是從交易即時加總出來的，漏記一筆就會跟實際差一輩子——對帳讓使用者輸入
              真正的餘額，差額補成一筆調整交易，不用回頭翻整份紀錄找是哪裡少記。 */}
          <button
            type="button"
            onClick={() => setReconcileOpen(true)}
            className="mt-3 w-full rounded-xl border border-[#ECE4FA] py-2 text-xs font-medium text-[#6F5FD6]"
          >
            對帳：輸入實際{kind === "liability" ? "欠款" : "餘額"}，差額自動補一筆
          </button>
        </CardBody>
      </Card>

      <ReconcileModal
        key={reconcileOpen ? `reconcile-${currentBalance}` : "reconcile-closed"}
        open={reconcileOpen}
        accountName={account.name}
        accountKind={kind}
        currentBalance={currentBalance}
        categories={categories}
        date={todayISO}
        onClose={() => setReconcileOpen(false)}
        onSave={handleReconcile}
      />

      <DateFilterPicker />
      <div className="-mt-1 mb-2 flex justify-end">
        <ComparePicker />
      </div>

      <KpiCard
        label="這段期間收入"
        value={formatCurrency(totalIncome)}
        valueColor="#4A3B7C"
        delta={incomeDelta && <DeltaBadge delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp suffix={deltaSuffix} className="shrink-0" />}
      />
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="這段期間支出"
          value={formatCurrency(totalExpense)}
          valueColor="#4A3B7C"
          delta={expenseDelta && <DeltaBadge delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} suffix={deltaSuffix} className="shrink-0" />}
        />
        <KpiCard
          label="這段期間結餘"
          value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
          valueColor={balance >= 0 ? "#4A3B7C" : KPI_NEGATIVE}
          delta={balanceDelta && <DeltaBadge delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp suffix={deltaSuffix} className="shrink-0" />}
        />
      </div>

      <Card>
        <CardBody>
          <p className={text.sectionHeading}>明細</p>
          {entries.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間這個帳戶還沒有掛任何交易或轉帳。</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {[...groups.entries()].map(([date, items]) => (
                <div key={date}>
                  <p className={`mb-1.5 font-medium ${text.muted}`}>{date}</p>
                  <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
                    {items.map((e) => {
                      if (e.kind === "tx") {
                        const t = e.tx;
                        const category = categoryById(categories, t.categoryId);
                        const isIncome = category?.kind === "收入";
                        const breakdown = t.breakdown ?? [];
                        const expanded = expandedIds.has(t.id);
                        // 這一頁本身就是這個帳戶的明細，不用再標帳戶名稱——只標「這筆
                        // 記完之後」這個帳戶變成多少。
                        const balanceAfter = accountBalances.get(`tx:${t.id}`);
                        return (
                          <div key={t.id}>
                            <div className="flex w-full items-center gap-1 px-3 py-3">
                              <button
                                type="button"
                                onClick={() => setTxModal({ mode: "edit", transaction: t })}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                <TransactionRowLabel
                                  icon={category?.icon ?? ""}
                                  iconClassName={category ? categoryColorClass[category.color] : undefined}
                                  title={transactionDisplayName(t, categories)}
                                  subtitle={categoryPath(categories, t.categoryId)}
                                />
                                <div className="flex shrink-0 flex-col items-end">
                                  <span className={`tabular-nums font-semibold text-[#4A3B7C] ${isIncome ? "text-[#2FAE82]" : ""}`}>
                                    {isIncome ? "＋" : "－"}
                                    {formatCurrency(t.amount)}
                                  </span>
                                  {balanceAfter !== undefined && <span className={`mt-0.5 tabular-nums ${text.faint}`}>餘額 {formatCurrency(balanceAfter)}</span>}
                                </div>
                              </button>
                              {breakdown.length > 0 && <BreakdownToggle expanded={expanded} onClick={() => toggleExpanded(t.id)} />}
                            </div>
                            {expanded && breakdown.length > 0 && <TransactionBreakdown items={breakdown} />}
                          </div>
                        );
                      }

                      const transfer = e.transfer;
                      const isOutgoing = transfer.fromAccountId === account.id;
                      const otherAccount = accounts.find((a) => a.id === (isOutgoing ? transfer.toAccountId : transfer.fromAccountId));
                      const transferBalanceAfter = accountBalances.get(`transfer:${transfer.id}`);
                      return (
                        <button
                          key={transfer.id}
                          type="button"
                          onClick={() => setTransferModal(transfer)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left"
                        >
                          <TransactionRowLabel
                            icon="⇄"
                            title={isOutgoing ? `轉帳至 ${otherAccount?.name ?? "（未知帳戶）"}` : `轉帳自 ${otherAccount?.name ?? "（未知帳戶）"}`}
                            subtitle={transfer.note || "轉帳"}
                          />
                          <div className="flex shrink-0 flex-col items-end">
                            <span className="tabular-nums font-semibold text-[#6F5FD6]">
                              {isOutgoing ? "－" : "＋"}
                              {formatCurrency(transfer.amount)}
                            </span>
                            {transferBalanceAfter !== undefined && (
                              <span className={`mt-0.5 tabular-nums ${text.faint}`}>餘額 {formatCurrency(transferBalanceAfter)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
