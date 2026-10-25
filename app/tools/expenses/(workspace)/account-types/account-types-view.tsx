"use client";

import { useEffect, useState } from "react";
import { ListCardSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ListCard } from "@/components/expenses/list-row";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { Card, CardBody } from "@/components/expenses/card";
import { DateField } from "@/components/expenses/date-field";
import { accountTypesByKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass, categoryFillClass, type CategoryDTO } from "@/lib/expenses/categories";
import { accountsByKind, sumByAccountType, type AccountDTO } from "@/lib/expenses/accounts";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 那個月的最後一天（`2026-10` → `2026-10-31`）。餘額是「到某一天為止」算出來的，
 *  看某個月就是看那個月月底當時的數字。 */
function monthEnd(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export function AccountTypesView() {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  // 餘額要靠帳戶＋交易＋轉帳才算得出來，所以這一頁不只抓類型本身。
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [ready, setReady] = useState(false);
  // 載入中畫骨架，列數用上次記住的實際筆數（見 skeleton-count.ts）。
  const skeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:account-types", 4, ready ? accountTypes.length : undefined);
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{ inUseCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
    ])
      .then(([data, accountsData, txData, categoriesData, transfersData]: [
        { accountTypes?: AccountTypeDTO[] },
        { accounts?: AccountDTO[] },
        { transactions?: TransactionDTO[] },
        { categories?: CategoryDTO[] },
        { transfers?: TransferDTO[] },
      ]) => {
        if (cancelled) return;
        setAccountTypes(data.accountTypes ?? []);
        setAccounts(accountsData.accounts ?? []);
        setTransactions(txData.transactions ?? []);
        setCategories(categoriesData.categories ?? []);
        setTransfers(transfersData.transfers ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: AccountTypeModalDraft) {
    if (!modal) return;
    const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accountTypes) setAccountTypes(data.accountTypes);
    setModal(null);
  }

  // 刪除類型沒有「未分類」這種通用歸宿可以自動改掛（見 account-types.server.ts 的
  // 說明），所以這裡不是問「要不要強制刪除」，查到還有帳戶在用就直接擋下、告知筆數，
  // 使用者要先把那些帳戶改到別的類型才能刪除。
  async function tryDeleteTypes(ids: string[]) {
    let latest = accountTypes;
    let totalInUse = 0;
    let blockedCount = 0;
    for (const id of ids) {
      const res = await fetch(`/api/expenses/account-types?id=${id}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { accountTypes?: AccountTypeDTO[]; inUseCount?: number } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blockedCount++;
        totalInUse += data.inUseCount ?? 0;
      } else if (data.accountTypes) {
        latest = data.accountTypes;
      }
    }
    setAccountTypes(latest);
    return { blockedCount, totalInUse };
  }

  async function handleDelete() {
    if (!modal) return;
    const { blockedCount, totalInUse } = await tryDeleteTypes([modal.id]);
    setModal(null);
    if (blockedCount > 0) setBlockedInfo({ inUseCount: totalInUse });
  }

  async function handleBulkDelete() {
    const { blockedCount, totalInUse } = await tryDeleteTypes([...selection.selectedIds]);
    selection.exit();
    if (blockedCount > 0) setBlockedInfo({ inUseCount: totalInUse });
  }

  // 批次新增：逐筆依序 POST（不是 Promise.all 併發），理由跟分類批次新增一樣——
  // createAccountType 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleBatchSave(items: AccountTypeBatchItem[]) {
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
    setBatchOpen(false);
  }

  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selection = useSelection(accountTypes.map((t) => t.id));

  // 這個月月底當時的餘額：餘額函式本來就是「傳進去哪些交易／轉帳就算哪些」，把那天
  // 之後的篩掉再算一次就是當時的數字（見 lib/expenses/accounts.ts 的 netWorthAt）。
  const asOf = monthEnd(yearMonth);
  const txUntil = transactions.filter((t) => t.date <= asOf);
  const transfersUntil = transfers.filter((t) => t.date <= asOf);
  const assetByType = sumByAccountType(accountsByKind(accounts, accountTypes, "asset"), accountTypes, txUntil, categories, transfersUntil);
  const liabilityByType = sumByAccountType(accountsByKind(accounts, accountTypes, "liability"), accountTypes, txUntil, categories, transfersUntil);
  const assetTotal = [...assetByType.values()].reduce((a, b) => a + b, 0);
  const liabilityTotal = [...liabilityByType.values()].reduce((a, b) => a + b, 0);
  const net = assetTotal - liabilityTotal;
  // 進度條走「淨資產佔資產多少」：條愈滿代表欠得愈少，跟預算那條「用掉多少」剛好相反，
  // 但同樣是一個 0–100 的比例，版面完全一樣。
  const netPct = assetTotal > 0 ? Math.round((net / assetTotal) * 100) : 0;

  /** 一個類型底下所有帳戶的餘額，以及它佔同類型總額的百分比。 */
  function rowOf(type: AccountTypeDTO) {
    const totals = type.kind === "asset" ? assetByType : liabilityByType;
    const total = type.kind === "asset" ? assetTotal : liabilityTotal;
    const amount = totals.get(type.id) ?? 0;
    return { amount, total, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
  }

  /** 資產／負債各一段：小標、清單，每一列是「類型名稱＋金額＋佔比進度條」。 */
  function section(title: string, types: AccountTypeDTO[]) {
    if (types.length === 0) return null;
    return (
      <div>
        <p className={`mb-2 px-1 ${text.sectionHeading}`}>{title}</p>
        <ListCard>
          {types.map((t) => {
            const { amount, total, pct } = rowOf(t);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
                className="w-full px-4 py-3.5 text-left"
              >
                <div className="flex w-full items-center gap-3">
                  {selection.selecting && <SelectionDot selected={selection.selectedIds.has(t.id)} />}
                  <ListProgressRow
                    icon={t.icon}
                    iconClassName={categoryColorClass[t.color]}
                    name={t.name}
                    amount={`${formatCurrency(amount)} / ${formatCurrency(total)}`}
                    pct={pct}
                    barColorClass={categoryFillClass[t.color]}
                  />
                </div>
              </button>
            );
          })}
        </ListCard>
      </div>
    );
  }

  return (
    <div>
      {/* 標題列只留「選取」——新增搬到右下角的浮動按鈕（跟首頁新增交易同一招），
          按鈕一多擠一列在手機上會換行成兩排，很難看也很難點。常見類型現在是第一次進
          記帳本時就自動建好的（見 lib/expenses/presets.server.ts），不再需要套用按鈕。 */}
      <PageHeader
        title="帳戶類型"
        // 這一頁現在是從「設定」進來的，標題列不再掛「返回資產總表」那顆箭頭——
        // 指回一個不是上一頁的地方只會讓人迷路，要回去按瀏覽器/系統的返回就好。
        actions={<SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />}
      />

      <FloatingAddButton onClick={() => setBatchOpen(true)} label="新增帳戶類型" />

      <AccountTypeModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        initial={modal ?? undefined}
        accountTypes={accountTypes}
        kind={modal?.kind ?? "asset"}
        excludeId={modal?.id}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <AccountTypeBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onSave={handleBatchSave} accountTypes={accountTypes} />

      <ConfirmModal
        open={blockedInfo !== null}
        title="這個類型還有帳戶在用"
        message={`還有 ${blockedInfo?.inUseCount ?? 0} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。`}
        onlyAcknowledge
        onClose={() => setBlockedInfo(null)}
      />

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={handleBulkDelete}
        />
      )}

      {/* 月份、總覽卡、清單三段的排法跟預算設定頁一樣——那一頁是「這個月花到哪」，
          這一頁是「這個月底各類型有多少」，同一種看法。 */}
      <div className="mb-4">
        <label className="flex flex-col gap-1.5">
          <span className={text.label}>月份</span>
          <DateField value={yearMonth} onChange={setYearMonth} granularity="month" />
        </label>
      </div>

      <Card className="mb-4">
        <CardBody>
          <p className={text.muted}>{yearMonth} 淨資產</p>
          <div className="mt-0.5 flex items-end justify-between">
            <p className={text.statValue}>
              {formatCurrency(net)}
              <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ 資產 {formatCurrency(assetTotal)}</span>
            </p>
            <span className={`text-xs font-semibold ${net < 0 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{netPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3EFFC]">
            <div
              className={`h-full rounded-full ${net < 0 ? "bg-[#D1517E]" : "bg-[#6F5FD6]"}`}
              style={{ width: `${Math.min(100, Math.max(netPct, 0))}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {!skeletonReady ? null : !ready ? (
        <ListCardSkeleton count={skeletonCount} progress />
      ) : accountTypes.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶類型，點右下角的＋新增</p>
      ) : (
        <div className="flex flex-col gap-5">
          {section("資產", assetTypes)}
          {section("負債", liabilityTypes)}
        </div>
      )}
    </div>
  );
}
