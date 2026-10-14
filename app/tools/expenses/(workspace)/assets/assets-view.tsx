"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, ButtonLink } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { text } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { accountsByKind, accountBalance, totalByKind, netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

export function AssetsView() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
    ])
      .then(
        ([accountsData, accountTypesData, txData, categoriesData]: [
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { transactions?: TransactionDTO[] },
          { categories?: CategoryDTO[] },
        ]) => {
          if (cancelled) return;
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setTransactions(txData.transactions ?? []);
          setCategories(categoriesData.categories ?? []);
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

  async function handleCreate(draft: AccountModalDraft) {
    const data: { accounts?: AccountDTO[] } = await fetch("/api/expenses/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accounts) setAccounts(data.accounts);
    setCreateOpen(false);
  }

  const assets = accountsByKind(accounts, accountTypes, "asset");
  const liabilities = accountsByKind(accounts, accountTypes, "liability");
  const net = netWorth(accounts, accountTypes, transactions, categories);

  return (
    <div>
      <PageHeader
        title="資產總表"
        description="帳戶餘額依期初餘額加總掛在帳戶上的交易即時算出，跟消費紀錄連動；點帳戶可以看明細"
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/tools/expenses/account-types" variant="secondary">
              帳戶類型
            </ButtonLink>
            <Button onClick={() => setCreateOpen(true)}>＋ 新增帳戶</Button>
          </div>
        }
      />

      <AccountModal open={createOpen} accountTypes={accountTypes} onClose={() => setCreateOpen(false)} onSave={handleCreate} />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : accounts.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶，點上方新增第一個</p>
      ) : (
        <>
          <Card className="mb-5">
            <CardBody>
              <p className={text.muted}>淨資產</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${net < 0 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{formatCurrency(net)}</p>
              <p className={`mt-1 ${text.muted}`}>
                資產 {formatCurrency(totalByKind(accounts, accountTypes, transactions, categories, "asset"))} － 負債{" "}
                {formatCurrency(totalByKind(accounts, accountTypes, transactions, categories, "liability"))}
              </p>
            </CardBody>
          </Card>

          {assets.length > 0 && (
            <div className="mb-5">
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>資產</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {assets.map((a) => (
                  <Link key={a.id} href={`/tools/expenses/assets/${a.id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <IconAvatar icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${text.body}`}>{a.name}</span>
                      <span className={`block ${text.muted}`}>{accountTypeById(accountTypes, a.accountTypeId)?.name ?? "（未知類型）"}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">
                      {formatCurrency(accountBalance(a, accountTypes, transactions, categories))}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {liabilities.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {liabilities.map((a) => (
                  <Link key={a.id} href={`/tools/expenses/assets/${a.id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <IconAvatar icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${text.body}`}>{a.name}</span>
                      <span className={`block ${text.muted}`}>{accountTypeById(accountTypes, a.accountTypeId)?.name ?? "（未知類型）"}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-[#D1517E]">
                      －{formatCurrency(accountBalance(a, accountTypes, transactions, categories))}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
