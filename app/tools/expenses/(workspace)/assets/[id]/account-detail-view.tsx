"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/expenses/page-header";
import { ButtonLink, IconButton } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { dateFilterRange, previousPeriodSuffix } from "@/lib/expenses/date-filter";
import { categoryById, categoryColorClass, categoryPath, type CategoryDTO } from "@/lib/expenses/categories";
import { totalsForRange, rangeDelta, transactionsInDateRange, type TransactionDTO } from "@/lib/expenses/transactions";
import { accountBalance, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { formatCurrency } from "@/lib/format";

const NEGATIVE = "#D1517E";

/** 跟 dashboard-view.tsx 的 KpiCard 同一種版面（圖示在左、標籤+金額+漲跌幅在右），
 *  這裡是這個帳戶自己的收入/支出/結餘，不是全部帳戶合計。 */
function KpiCard({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  valueColor,
  delta,
}: {
  icon: string;
  iconBg: string;
  iconFg: string;
  label: string;
  value: string;
  valueColor: string;
  delta: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: iconBg, color: iconFg }}>
          {icon}
        </span>
        <p className={`mt-2 ${text.muted}`}>{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <p className="text-lg font-bold tabular-nums" style={{ color: valueColor }}>
            {value}
          </p>
          {delta}
        </div>
      </CardBody>
    </Card>
  );
}

type TxModalState = { mode: "create" } | { mode: "edit"; transaction: TransactionDTO };

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { filter } = useDateFilter();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [txModal, setTxModal] = useState<TxModalState | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
    ])
      .then(
        ([accountsData, accountTypesData, categoriesData, txData]: [
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
        ]) => {
          if (cancelled) return;
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
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
    await fetch(`/api/expenses/accounts?id=${accountId}`, { method: "DELETE" }).catch(() => {});
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

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <ButtonLink href="/tools/expenses/assets" variant="ghost">
          ‹ 回資產總表
        </ButtonLink>
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        <ButtonLink href="/tools/expenses/assets" variant="ghost">
          ‹ 回資產總表
        </ButtonLink>
        <p className={text.faint}>找不到這個帳戶，可能已經被刪除</p>
      </div>
    );
  }

  const type = accountTypeById(accountTypes, account.accountTypeId);
  const accountTx = transactions.filter((t) => t.accountId === account.id);
  const range = dateFilterRange(filter);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(accountTx, r).length > 0;

  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(accountTx, categories, range);
  const incomeDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).totalIncome, filter, hasPriorData);
  const expenseDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).totalExpense, filter, hasPriorData);
  const balanceDelta = rangeDelta((r) => totalsForRange(accountTx, categories, r).balance, filter, hasPriorData);
  const deltaSuffix = previousPeriodSuffix(filter.mode);

  const rows = [...expenseTx, ...incomeTx].sort((a, b) => (a.date < b.date ? 1 : -1));
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }

  const kind = accountTypeById(accountTypes, account.accountTypeId)?.kind ?? "asset";
  const currentBalance = accountBalance(account, accountTypes, transactions, categories);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={account.name}
        description={type ? `${type.icon} ${type.name}` : "（未知類型）"}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/tools/expenses/assets" variant="ghost">
              ‹ 回資產總表
            </ButtonLink>
            <IconButton aria-label="編輯帳戶資料" onClick={() => setEditOpen(true)}>
              ✏️
            </IconButton>
          </div>
        }
      />

      <AccountModal
        open={editOpen}
        accountTypes={accountTypes}
        initial={{ name: account.name, accountTypeId: account.accountTypeId, openingBalance: account.openingBalance }}
        onClose={() => setEditOpen(false)}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
      />

      <TransactionModal
        key={txModal ? JSON.stringify(txModal) : "closed"}
        open={txModal !== null}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        defaultKind="支出"
        initial={txModal?.mode === "edit" ? txModal.transaction : undefined}
        onClose={() => setTxModal(null)}
        onSave={handleTxSave}
        onDelete={txModal?.mode === "edit" ? handleTxDelete : undefined}
      />

      <Card>
        <CardBody className="flex items-center justify-between py-3.5">
          <div>
            <p className={text.muted}>目前{kind === "liability" ? "欠款" : "餘額"}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${kind === "liability" ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>
              {formatCurrency(currentBalance)}
            </p>
          </div>
          <IconAvatar icon={type?.icon ?? "❓"} />
        </CardBody>
      </Card>

      <DateFilterPicker />

      <KpiCard
        icon="💰"
        iconBg="#E3F6EC"
        iconFg="#2FAE82"
        label="這段期間收入"
        value={formatCurrency(totalIncome)}
        valueColor="#4A3B7C"
        delta={incomeDelta && <DeltaBadge delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp suffix={deltaSuffix} className="shrink-0" />}
      />
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon="🛍️"
          iconBg="#FDEEF0"
          iconFg="#D1517E"
          label="這段期間支出"
          value={formatCurrency(totalExpense)}
          valueColor="#4A3B7C"
          delta={expenseDelta && <DeltaBadge delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} suffix={deltaSuffix} className="shrink-0" />}
        />
        <KpiCard
          icon="🐷"
          iconBg="#E6EEFC"
          iconFg="#4E7FE0"
          label="這段期間結餘"
          value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
          valueColor={balance >= 0 ? "#4A3B7C" : NEGATIVE}
          delta={balanceDelta && <DeltaBadge delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp suffix={deltaSuffix} className="shrink-0" />}
        />
      </div>

      <Card>
        <CardBody>
          <p className={text.sectionHeading}>明細</p>
          {rows.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間這個帳戶還沒有掛任何交易。</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {[...groups.entries()].map(([date, items]) => (
                <div key={date}>
                  <p className={`mb-1.5 font-medium ${text.muted}`}>{date}</p>
                  <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
                    {items.map((t) => {
                      const category = categoryById(categories, t.categoryId);
                      const isIncome = category?.kind === "收入";
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTxModal({ mode: "edit", transaction: t })}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left"
                        >
                          <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#4A3B7C]">{t.note ?? category?.name}</p>
                            <p className={`truncate ${text.muted}`}>{categoryPath(categories, t.categoryId)}</p>
                          </div>
                          <span className={`shrink-0 tabular-nums font-semibold text-[#4A3B7C] ${isIncome ? "text-[#2FAE82]" : ""}`}>
                            {isIncome ? "＋" : ""}
                            {formatCurrency(t.amount)}
                          </span>
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
