"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { dateFilterRange, previousPeriodSuffix } from "@/lib/expenses/date-filter";
import { categoryById, categoryColorClass, categoryPath, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import {
  transactionsInDateRange,
  totalsForRange,
  rangeDelta,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

function matchesQuery(t: TransactionDTO, categories: CategoryDTO[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [t.note, categoryPath(categories, t.categoryId), t.date].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

export function TransactionsView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CategoryKind>("支出");
  // 這頁現在只處理既有紀錄的編輯（新增交易改到首頁的浮動按鈕），所以只需要存「正在編輯
  // 哪一筆」，不用再分 create/edit 兩種模式。
  const [modal, setModal] = useState<TransactionDTO | null>(null);
  const isSearching = query.trim().length > 0;
  const range = dateFilterRange(filter);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, accountsData, accountTypesData, transfersData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { transfers?: TransferDTO[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
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

  const inKind = (t: TransactionDTO) => (categoryById(categories, t.categoryId)?.kind ?? "支出") === kind;
  const totals = totalsForRange(transactions, categories, range);

  const rows = (isSearching ? transactions.filter(inKind) : totals[kind === "支出" ? "expenseTx" : "incomeTx"])
    .filter((t) => matchesQuery(t, categories, query))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  const delta = rangeDelta(
    (r) => totalsForRange(transactions, categories, r)[kind === "支出" ? "totalExpense" : "totalIncome"],
    filter,
    (r) => transactionsInDateRange(transactions, r).length > 0,
  );
  const deltaSuffix = previousPeriodSuffix(filter.mode);

  // 依日期分組，App 常見的「日期當小標題」條列方式；搜尋時日期標題本身就能告訴使用者是哪個時間。
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }

  async function handleSave(draft: TransactionModalDraft) {
    if (!modal) return;
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setModal(null);
  }

  async function handleDelete() {
    if (!modal) return;
    const data: { transactions?: TransactionDTO[] } = await fetch(`/api/expenses/transactions?id=${modal.id}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setModal(null);
  }

  return (
    <div>
      <DateFilterPicker className="mb-4" />

      <TransactionModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind={kind}
        initial={modal ?? undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
        onCategoriesChange={setCategories}
      />

      <div className="mb-4">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-full border border-[#ECE4FA] bg-white px-4 py-2.5">
        <span aria-hidden className="text-[#9C94C4]">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`搜尋備註、分類⋯不限${filter.mode === "all" ? "" : "期間"}`}
          className="w-full bg-transparent text-sm text-[#4A3B7C] outline-none placeholder:text-[#B3ABD4]"
        />
      </label>

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : (
        <>
          {isSearching ? (
            <p className={`mb-4 px-1 ${text.muted}`}>
              「{query.trim()}」在所有時間的{kind}紀錄中共 {rows.length} 筆符合，不受上方日期篩選影響
            </p>
          ) : (
            rows.length > 0 && (
              <Card className="mb-4">
                <CardBody className="flex items-center justify-between py-3.5">
                  <div>
                    <p className={text.muted}>這段期間共{kind === "支出" ? "花費" : "收入"}</p>
                    <p className={`mt-0.5 ${text.statValue}`}>{formatCurrency(total)}</p>
                  </div>
                  {delta && <DeltaBadge delta={delta.delta} pct={delta.pct} goodWhenUp={kind === "收入"} suffix={deltaSuffix} />}
                </CardBody>
              </Card>
            )
          )}

          {rows.length === 0 ? (
            <Card>
              <CardBody className={`py-10 text-center ${text.muted}`}>
                {isSearching ? "沒有符合的紀錄。" : `這段期間還沒有${kind}紀錄。`}
              </CardBody>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {[...groups.entries()].map(([date, items]) => (
                <div key={date}>
                  <p className={`mb-1.5 px-1 font-medium ${text.muted}`}>{date}</p>
                  <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                    {items.map((t) => {
                      const category = categoryById(categories, t.categoryId);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setModal(t)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left"
                        >
                          <IconAvatar icon={category?.icon ?? ""} size="sm" className={category ? categoryColorClass[category.color] : undefined} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#4A3B7C]">{t.note ?? category?.name}</p>
                            <p className={`truncate ${text.muted}`}>{categoryPath(categories, t.categoryId)}</p>
                          </div>
                          <span className={`shrink-0 tabular-nums font-semibold text-[#4A3B7C] ${kind === "收入" ? "text-[#2FAE82]" : ""}`}>
                            {kind === "收入" ? "＋" : "－"}
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
        </>
      )}
    </div>
  );
}
