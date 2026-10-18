"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, ButtonLink } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { DonutChart, type DonutSlice } from "@/components/expenses/donut-chart";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { AssetComparePicker } from "@/components/expenses/asset-compare-picker";
import { text, gradient, shadow } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { accountsByKind, accountBalance, balanceDelta, totalByKind, netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorHex, type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { assetCompareDate, defaultAssetCompareSetting, type AssetCompareSetting } from "@/lib/expenses/asset-compare";
import { formatCurrency } from "@/lib/format";

// 帳戶類型沒有自己的顏色欄位（只有圖示），資產配置圖借用分類佔比圖同一組色票循環上色，
// 不是另外配的新色票。
const ASSET_TYPE_COLORS = Object.values(categoryColorHex);

const COMPARE_STORAGE_KEY = "cpx-tools:expenses-asset-compare";

function loadSavedCompare(): AssetCompareSetting | null {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.mode === "string") return parsed as AssetCompareSetting;
  } catch {
    /* 私密視窗等情況或資料壞掉，忽略，用預設值 */
  }
  return null;
}

/** 依帳戶類型加總餘額——「資產配置」現在跟過去都要算一次（見下面比較基準的說明），
 *  拆成函式避免兩份幾乎一樣的迴圈。 */
function sumByAccountType(assets: AccountDTO[], accountTypes: AccountTypeDTO[], tx: TransactionDTO[], categories: CategoryDTO[], transfers: TransferDTO[]) {
  const totals = new Map<string, number>();
  for (const a of assets) {
    totals.set(a.accountTypeId, (totals.get(a.accountTypeId) ?? 0) + accountBalance(a, accountTypes, tx, categories, transfers));
  }
  return totals;
}

export function AssetsView() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [compareSetting, setCompareSettingState] = useState<AssetCompareSetting>(() => loadSavedCompare() ?? defaultAssetCompareSetting());
  // 掛載時算一次固定住（本地日期，不是 UTC）——在 render 當中讀時鐘是不純的，
  // toISOString() 在台灣時區的凌晨又會跳回前一天，兩個理由都要避開。
  const [todayISO] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  function setCompareSetting(setting: AssetCompareSetting) {
    setCompareSettingState(setting);
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(setting));
    } catch {
      /* 忽略 */
    }
  }

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
  const totalAssets = totalByKind(accounts, accountTypes, transactions, categories, transfers, "asset");
  const totalLiabilities = totalByKind(accounts, accountTypes, transactions, categories, transfers, "liability");

  // 比較基準：淨資產沒有「這個月的淨資產」這種區間加總的概念，只有「某一天當時是多少」，
  // 所以算法是把交易／轉帳都篩成「日期 <= 基準日」的子集合，餘額函式本來就是「傳進去
  // 哪些資料就算哪些」，直接重算一次即可（見 lib/expenses/asset-compare.ts 的說明）。
  const compareDate = assetCompareDate(compareSetting, todayISO);
  const compareTx = compareDate ? transactions.filter((t) => t.date <= compareDate) : [];
  const compareTransfers = compareDate ? transfers.filter((t) => t.date <= compareDate) : [];
  const netDelta = compareDate ? balanceDelta(net, netWorth(accounts, accountTypes, compareTx, categories, compareTransfers)) : null;
  const assetsDelta = compareDate
    ? balanceDelta(totalAssets, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "asset"))
    : null;
  const liabilitiesDelta = compareDate
    ? balanceDelta(totalLiabilities, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "liability"))
    : null;

  // 資產配置：依帳戶類型（股票、黃金…）加總餘額，算出各類型佔總資產的百分比。
  const assetTypeTotals = sumByAccountType(assets, accountTypes, transactions, categories, transfers);
  const assetTypeTotalsBefore = compareDate ? sumByAccountType(assets, accountTypes, compareTx, categories, compareTransfers) : null;
  const assetTypeSum = [...assetTypeTotals.values()].reduce((sum, v) => sum + v, 0) || 1;
  const assetTypeBreakdown = [...assetTypeTotals.entries()]
    .map(([typeId, amount], i) => {
      const type = accountTypeById(accountTypes, typeId);
      // 比較基準開著的話，顯示這一類「比基準那天」增加／減少了多少——沒出現在
      // before 這份 Map 裡（當時這類資產還沒有任何帳戶）就當作從 0 開始。
      const before = assetTypeTotalsBefore?.get(typeId) ?? (assetTypeTotalsBefore ? 0 : undefined);
      return {
        id: typeId,
        name: type?.name ?? "（未知類型）",
        icon: type?.icon ?? "❓",
        amount,
        pct: (amount / assetTypeSum) * 100,
        colorHex: ASSET_TYPE_COLORS[i % ASSET_TYPE_COLORS.length],
        changeAmount: before === undefined ? null : amount - before,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  const assetTypeDonutData: DonutSlice[] = assetTypeBreakdown.map((r) => ({ id: r.id, label: r.name, amount: r.amount, colorHex: r.colorHex }));
  const assetTypeColor = new Map(assetTypeBreakdown.map((r) => [r.id, r.colorHex]));

  return (
    <div>
      {/* 新增帳戶搬到右下角的浮動按鈕，跟首頁新增交易同一招——標題列只留「帳戶類型」
          跟「轉帳」兩個比較少按、不需要隨手可點的操作。 */}
      <PageHeader
        title="資產總表"
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/tools/expenses/account-types" variant="secondary">
              帳戶類型
            </ButtonLink>
            <Button variant="secondary" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              ⇄ 轉帳
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex justify-end">
        <AssetComparePicker setting={compareSetting} onChange={setCompareSetting} />
      </div>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        aria-label="新增帳戶"
        className="fixed right-5 z-20 grid size-14 place-items-center rounded-full text-3xl font-bold leading-none text-white"
        style={{ background: gradient.primary, boxShadow: shadow.cta, bottom: "calc(env(safe-area-inset-bottom) + 86px)" }}
      >
        ＋
      </button>

      <AccountModal
        open={createOpen}
        accounts={accounts}
        accountTypes={accountTypes}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        onAccountTypesChange={setAccountTypes}
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
        <p className={text.faint}>還沒有任何帳戶，點右下角的＋新增第一個</p>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <KpiCard
              label="淨資產"
              value={`${net >= 0 ? "" : "－"}${formatCurrency(Math.abs(net))}`}
              valueColor={net < 0 ? KPI_NEGATIVE : "#4A3B7C"}
              delta={netDelta && <DeltaText delta={netDelta.delta} pct={netDelta.pct} goodWhenUp />}
            />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="資產"
                value={formatCurrency(totalAssets)}
                valueColor="#4A3B7C"
                delta={assetsDelta && <DeltaText delta={assetsDelta.delta} pct={assetsDelta.pct} goodWhenUp />}
              />
              <KpiCard
                label="負債"
                value={formatCurrency(totalLiabilities)}
                valueColor="#4A3B7C"
                delta={liabilitiesDelta && <DeltaText delta={liabilitiesDelta.delta} pct={liabilitiesDelta.pct} goodWhenUp={false} />}
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
                        <span className="flex items-center gap-2">
                          {/* 這一類比基準日增加／減少多少——沒有變化（0）或還沒選比較基準
                              就不顯示，不然每一列都掛一個「＋0」反而是噪音。 */}
                          {r.changeAmount !== null && r.changeAmount !== 0 && (
                            <span className="tabular-nums font-medium" style={{ color: r.changeAmount > 0 ? "#2FAE82" : "#D1517E" }}>
                              {r.changeAmount > 0 ? "▲" : "▼"}
                              {formatCurrency(Math.abs(r.changeAmount))}
                            </span>
                          )}
                          <span className={`tabular-nums ${text.muted}`}>{r.pct.toFixed(1)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* 這兩個區塊原本各自有一顆「＋新增」，開的也是「新增帳戶類型」彈窗——跟
              「新增帳戶」彈窗裡本來就有的那兩格「＋新增」（見 AccountModal）功能重複，
              拿掉後新增類型只保留一個入口，不用分散在兩個地方維護同一個操作。 */}
          {assets.length > 0 && (
            <div className="mb-5">
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>資產</p>
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
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
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
