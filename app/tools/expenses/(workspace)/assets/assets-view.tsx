"use client";

import { useEffect, useState } from "react";
import { CardSkeleton, KpiCardSkeleton, SectionSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { Card, CardBody } from "@/components/expenses/card";
import { KpiCard, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { text } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { accountsByKind, accountBalance, netWorth, totalByKind, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, accountTypeColorClass, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

export function AssetsView() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  // 載入中畫骨架，列數用上次記住的實際筆數（見 skeleton-count.ts）。
  const [createOpen, setCreateOpen] = useState(false);
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
  // 資產跟負債兩段各記各的筆數——大多數人資產好幾個、負債零到一個，共用一個數字一定
  // 有一段對不上。
  const assetSkeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:assets-asset", 2, ready ? assets.length : undefined);
  const liabilitySkeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:assets-liability", 1, ready ? liabilities.length : undefined);
  // 頁面最上面先給一個「現在總共有多少」的結論，再往下才是一個一個帳戶——跟報表頁
  // 「這段期間支出」那張大卡、首頁「本月收入／本月支出」那兩張小卡同一套版面。
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const totalAssets = totalByKind(accounts, accountTypes, transactions, categories, transfers, "asset");
  const totalLiabilities = totalByKind(accounts, accountTypes, transactions, categories, transfers, "liability");
  return (
    <div>
      {/* 新增帳戶搬到右下角的浮動按鈕，跟首頁新增交易同一招——標題列只留「帳戶類型」
          跟「轉帳」兩個比較少按、不需要隨手可點的操作。 */}
      {/* 標題列不放按鈕：「帳戶類型」從設定頁 › 帳戶與資產 進去就好（同一個入口不用開兩個），
          「轉帳」移到下面「資產」區塊的標題旁邊——轉帳本來就是在動帳戶的錢，放在帳戶
          清單上方比放在整頁最上面更接近操作對象。 */}
      <PageHeader title="資產總表" />

      <FloatingAddButton onClick={() => setCreateOpen(true)} label="新增帳戶" />

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

      {ready && accounts.length > 0 && (
        <div className="mb-5 flex flex-col gap-3">
          <Card>
            <CardBody>
              <p className={text.muted}>淨資產</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#4A3B7C]">
                {net < 0 ? "－" : ""}
                {formatCurrency(Math.abs(net))}
              </p>
            </CardBody>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="資產" value={formatCurrency(totalAssets)} valueColor="#4A3B7C" />
            <KpiCard label="負債" value={formatCurrency(totalLiabilities)} valueColor={totalLiabilities > 0 ? KPI_NEGATIVE : "#4A3B7C"} />
          </div>
        </div>
      )}

      {!skeletonReady ? null : !ready ? (
        // 骨架照著載入完成後的版面排：淨資產大卡、資產/負債兩張小卡，再來是兩段帳戶清單。
        <div>
          <div className="mb-5 flex flex-col gap-3">
            <CardSkeleton>
              <SkeletonBar width={48} height={12} />
              <SkeletonBar width={148} height={24} className="mt-2" />
            </CardSkeleton>
            <div className="grid grid-cols-2 gap-3">
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <SectionSkeleton count={assetSkeletonCount} />
            <SectionSkeleton count={liabilitySkeletonCount} />
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶，點右下角的＋新增第一個</p>
      ) : (
        <>
          {/* 這兩個區塊原本各自有一顆「＋新增」，開的也是「新增帳戶類型」彈窗——跟
              「新增帳戶」彈窗裡本來就有的那兩格「＋新增」（見 AccountModal）功能重複，
              拿掉後新增類型只保留一個入口，不用分散在兩個地方維護同一個操作。 */}
          {assets.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className={text.sectionHeading}>資產</p>
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  disabled={accounts.length < 2}
                  className="text-xs font-medium text-[#6F5FD6] disabled:text-[#C7BFE6]"
                >
                  ⇄ 轉帳
                </button>
              </div>
              {/* 這一頁只回答「哪個帳戶有多少錢」：佔比的圓餅跟百分比都搬到報表的「資產」
                  分頁了，清單這裡留百分比反而是沒有上下文的孤兒數字。顯示的是帳戶自己的
                  名稱（兩個同類型的帳戶才分得出誰是誰），類型只貢獻圖示跟顏色。 */}
              <ListCard>
                {assets.map((a) => (
                  <ListRow
                    key={a.id}
                    href={`/tools/expenses/assets/${a.id}`}
                    icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"}
                    iconClassName={accountTypeColorClass(accountTypes, a.accountTypeId)}
                    name={a.name}
                    right={
                      <span className="tabular-nums font-semibold text-[#4A3B7C]">
                        {formatCurrency(accountBalance(a, accountTypes, transactions, categories, transfers))}
                      </span>
                    }
                  />
                ))}
              </ListCard>
            </div>
          )}

          {liabilities.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
              <ListCard>
                {liabilities.map((a) => (
                  <ListRow
                    key={a.id}
                    href={`/tools/expenses/assets/${a.id}`}
                    icon={accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓"}
                    iconClassName={accountTypeColorClass(accountTypes, a.accountTypeId)}
                    name={a.name}
                    right={
                      <span className="tabular-nums font-semibold text-[#D1517E]">
                        －{formatCurrency(accountBalance(a, accountTypes, transactions, categories, transfers))}
                      </span>
                    }
                  />
                ))}
              </ListCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
