"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, ButtonLink } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { DonutChart, type DonutSlice } from "@/components/expenses/donut-chart";
import { KpiCard, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { text } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { accountsByKind, accountBalance, totalByKind, netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorHex, type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

// 帳戶類型沒有自己的顏色欄位（只有圖示），資產配置圖借用分類佔比圖同一組色票循環上色，
// 不是另外配的新色票。
const ASSET_TYPE_COLORS = Object.values(categoryColorHex);

export function AssetsView() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeModalKind, setTypeModalKind] = useState<AccountKind>("asset");
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
    ])
      .then(
        ([accountsData, accountTypesData, txData, categoriesData, transfersData]: [
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { transactions?: TransactionDTO[] },
          { categories?: CategoryDTO[] },
          { transfers?: TransferDTO[] },
        ]) => {
          if (cancelled) return;
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setTransactions(txData.transactions ?? []);
          setCategories(categoriesData.categories ?? []);
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

  function openTypeModal(kind: AccountKind) {
    setTypeModalKind(kind);
    setTypeModalOpen(true);
  }

  // 逐筆依序 POST、不是 Promise.all 併發——跟 account-types-view.tsx 的 handleBatchSave
  // 同一個理由：新類型的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleCreateTypes(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    for (const item of items) {
      const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) latest = data.accountTypes;
    }
    setAccountTypes(latest);
    setTypeModalOpen(false);
  }

  async function handleCreateTransfer(draft: TransferModalDraft) {
    const data: { transfers?: TransferDTO[] } = await fetch("/api/expenses/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transfers) setTransfers(data.transfers);
    setTransferOpen(false);
  }

  const assets = accountsByKind(accounts, accountTypes, "asset");
  const liabilities = accountsByKind(accounts, accountTypes, "liability");
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);

  // 資產配置：依帳戶類型（股票、黃金…）加總餘額，算出各類型佔總資產的百分比。
  const assetTypeTotals = new Map<string, number>();
  for (const a of assets) {
    assetTypeTotals.set(
      a.accountTypeId,
      (assetTypeTotals.get(a.accountTypeId) ?? 0) + accountBalance(a, accountTypes, transactions, categories, transfers),
    );
  }
  const assetTypeSum = [...assetTypeTotals.values()].reduce((sum, v) => sum + v, 0) || 1;
  const assetTypeBreakdown = [...assetTypeTotals.entries()]
    .map(([typeId, amount], i) => {
      const type = accountTypeById(accountTypes, typeId);
      return {
        id: typeId,
        name: type?.name ?? "（未知類型）",
        icon: type?.icon ?? "❓",
        amount,
        pct: (amount / assetTypeSum) * 100,
        colorHex: ASSET_TYPE_COLORS[i % ASSET_TYPE_COLORS.length],
      };
    })
    .sort((a, b) => b.amount - a.amount);
  const assetTypeDonutData: DonutSlice[] = assetTypeBreakdown.map((r) => ({ id: r.id, label: r.name, amount: r.amount, colorHex: r.colorHex }));
  const assetTypeColor = new Map(assetTypeBreakdown.map((r) => [r.id, r.colorHex]));

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
            <Button variant="secondary" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              ⇄ 轉帳
            </Button>
            <Button onClick={() => setCreateOpen(true)}>＋ 新增帳戶</Button>
          </div>
        }
      />

      <AccountModal
        open={createOpen}
        accounts={accounts}
        accountTypes={accountTypes}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        onAccountTypesChange={setAccountTypes}
      />
      <AccountTypeBatchModal
        open={typeModalOpen}
        defaultKind={typeModalKind}
        accountTypes={accountTypes}
        onClose={() => setTypeModalOpen(false)}
        onSave={handleCreateTypes}
      />
      <TransferModal
        open={transferOpen}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        onClose={() => setTransferOpen(false)}
        onSave={handleCreateTransfer}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : accounts.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶，點上方新增第一個</p>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <KpiCard
              label="淨資產"
              value={`${net >= 0 ? "" : "－"}${formatCurrency(Math.abs(net))}`}
              valueColor={net < 0 ? KPI_NEGATIVE : "#4A3B7C"}
            />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="資產"
                value={formatCurrency(totalByKind(accounts, accountTypes, transactions, categories, transfers, "asset"))}
                valueColor="#4A3B7C"
              />
              <KpiCard
                label="負債"
                value={formatCurrency(totalByKind(accounts, accountTypes, transactions, categories, transfers, "liability"))}
                valueColor="#4A3B7C"
              />
            </div>
          </div>

          {assetTypeBreakdown.length > 0 && (
            <Card className="mb-5">
              <CardBody>
                <p className={text.sectionHeading}>資產配置</p>
                <div className="mt-4 flex items-center gap-5">
                  <DonutChart data={assetTypeDonutData} size={120} />
                  <div className="flex flex-1 flex-col gap-2">
                    {assetTypeBreakdown.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[#4A3B7C]">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.colorHex }} />
                          {r.name}
                        </span>
                        <span className={`tabular-nums ${text.muted}`}>{r.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {assets.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className={text.sectionHeading}>資產</p>
                <button type="button" onClick={() => openTypeModal("asset")} className="text-xs font-medium text-[#6F5FD6]">
                  ＋ 新增
                </button>
              </div>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {assets.map((a) => {
                  const balance = accountBalance(a, accountTypes, transactions, categories, transfers);
                  const pct = (balance / assetTypeSum) * 100;
                  return (
                    <Link key={a.id} href={`/tools/expenses/assets/${a.id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <ListProgressRow
                        icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"}
                        name={accountTypeById(accountTypes, a.accountTypeId)?.name ?? "（未知類型）"}
                        amount={formatCurrency(balance)}
                        pct={pct}
                        pctLabel={`${pct.toFixed(1)}%`}
                        barColorHex={assetTypeColor.get(a.accountTypeId) ?? "#B3ABD4"}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {liabilities.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <p className={text.sectionHeading}>負債</p>
                <button type="button" onClick={() => openTypeModal("liability")} className="text-xs font-medium text-[#6F5FD6]">
                  ＋ 新增
                </button>
              </div>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {liabilities.map((a) => (
                  <Link key={a.id} href={`/tools/expenses/assets/${a.id}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <IconAvatar icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"} size="sm" />
                    <span className={`min-w-0 flex-1 ${text.body}`}>{accountTypeById(accountTypes, a.accountTypeId)?.name ?? "（未知類型）"}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-[#D1517E]">
                      －{formatCurrency(accountBalance(a, accountTypes, transactions, categories, transfers))}
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
