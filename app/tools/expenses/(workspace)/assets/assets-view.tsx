"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardSkeleton, GroupedSectionSkeleton, KpiCardSkeleton, SectionSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady, useSkeletonShape } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { EmptyListCard, ListCard, ListRow } from "@/components/expenses/list-row";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { Card, CardBody } from "@/components/expenses/card";
import { DateField } from "@/components/expenses/date-field";
import { KpiCard, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { text } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { accountsByKind, accountBalance, netWorth, totalByKind, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypesByKind, accountTypeColorClass, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryFillClass, type CategoryDTO } from "@/lib/expenses/categories";
import { groupByDate, limitDateGroups, shiftMonths } from "@/lib/expenses/date-filter";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

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
  // 轉帳明細那一區：點某一列會開同一個轉帳彈窗來改／刪那一筆（轉帳沒有自己的明細頁，
  // 一筆轉帳就只有「從哪到哪、多少錢、哪一天」這幾個欄位，開一整頁去放四個欄位不划算）。
  const [transferEdit, setTransferEdit] = useState<TransferDTO | null>(null);
  const [transfersExpanded, setTransfersExpanded] = useState(false);
  // 看的是「哪一個月月底當時」的數字——從設定頁的帳戶類型搬過來的（那一頁現在只管
  // 類型的名稱／圖示／顏色，金額一律在這一頁看，見該檔案開頭的說明）。
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
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

  async function handleEditTransfer(draft: TransferModalDraft) {
    if (!transferEdit) return;
    const data: { transfers?: TransferDTO[] } = await fetch("/api/expenses/transfers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: transferEdit.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transfers) setTransfers(data.transfers);
    setTransferEdit(null);
  }

  async function handleDeleteTransfer() {
    if (!transferEdit) return;
    const data: { transfers?: TransferDTO[] } = await fetch(`/api/expenses/transfers?id=${transferEdit.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transfers) setTransfers(data.transfers);
    setTransferEdit(null);
  }

  const assets = accountsByKind(accounts, accountTypes, "asset");
  const liabilities = accountsByKind(accounts, accountTypes, "liability");
  // 資產跟負債兩段各記各的筆數——大多數人資產好幾個、負債零到一個，共用一個數字一定
  // 有一段對不上。
  const assetSkeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:assets-asset", 2, ready ? assets.length : undefined);
  const liabilitySkeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:assets-liability", 1, ready ? liabilities.length : undefined);

  // 選到的那個月月底當時的數字：餘額函式本來就是「傳進去哪些交易／轉帳就算哪些」，把
  // 那天之後的篩掉再算一次就是當時的狀況（見 lib/expenses/accounts.ts）。
  const asOf = monthEnd(yearMonth);
  const txUntil = transactions.filter((t) => t.date <= asOf);
  const transfersUntil = transfers.filter((t) => t.date <= asOf);

  // 頁面最上面先給一個「那時候總共有多少」的結論，再往下才是一個一個類型／帳戶——跟
  // 報表頁「這段期間支出」那張大卡、首頁的 KPI 卡同一套版面。
  const net = netWorth(accounts, accountTypes, txUntil, categories, transfersUntil);
  const totalAssets = totalByKind(accounts, accountTypes, txUntil, categories, transfersUntil, "asset");
  const totalLiabilities = totalByKind(accounts, accountTypes, txUntil, categories, transfersUntil, "liability");
  // 進度條走「淨資產佔資產多少」：條愈滿代表欠得愈少。
  const netPct = totalAssets > 0 ? Math.round((net / totalAssets) * 100) : 0;

  const balanceOf = (a: AccountDTO) => accountBalance(a, accountTypes, txUntil, categories, transfersUntil);

  // 轉帳明細：抓「近一個月」而不是跟著上面的月份選擇器只看那一個月。轉帳本來就記得稀疏
  // （一個月兩三筆很正常，有時整個月一筆都沒有），只看單月的話這一區常常是空的；而且
  // 起點是以「選到的月份為止最新的那一筆」往回推一個月，不是從今天往回推——不然月份
  // 翻到過去時這一區又會整個空掉（跟首頁「最近消費」同一招，那邊是往回推七天）。
  const sortedTransfers = [...transfersUntil].sort((a, b) => (a.date < b.date ? 1 : -1));
  const transferCutoff = sortedTransfers.length > 0 ? shiftMonths(sortedTransfers[0].date, -1) : "";
  const transferGroups = groupByDate(sortedTransfers.filter((t) => t.date >= transferCutoff));
  const transferCount = transferGroups.reduce((sum, [, items]) => sum + items.length, 0);
  // 每一天的小計照「那一天全部的轉帳」算，不是照收合後看得到的那幾筆——不然展開前後
  // 同一天會出現兩個不同的金額（理由同首頁 recentDayTotals）。
  const transferDayTotals = new Map(transferGroups.map(([date, items]) => [date, items.reduce((sum, t) => sum + t.amount, 0)]));
  const visibleTransferGroups = transfersExpanded ? transferGroups : limitDateGroups(transferGroups, PREVIEW_COUNT);
  // 這一區是「日期小標＋那天幾列」一組一組排的，只記總筆數還原不出組數，所以記形狀。
  const transferSkeletonShape = useSkeletonShape(
    "cpx-tools:expenses-skeleton:assets-transfers",
    [2, 1],
    ready ? visibleTransferGroups.map(([, items]) => items.length) : undefined,
  );

  const accountNameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "（未知帳戶）";

  /** 一種資產／負債底下：每個類型一組（類型自己一列帶佔比進度條，它的帳戶列在下面）。 */
  function typeGroups(kind: AccountKind) {
    const total = kind === "asset" ? totalAssets : totalLiabilities;
    return accountTypesByKind(accountTypes, kind)
      .map((type) => {
        const typeAccounts = accounts.filter((a) => a.accountTypeId === type.id);
        const amount = typeAccounts.reduce((sum, a) => sum + balanceOf(a), 0);
        return { type, accounts: typeAccounts, amount, total, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
      })
      // 沒有任何帳戶的類型不列出來——那是「還沒用到的類型」，要管理它去設定頁。
      .filter((g) => g.accounts.length > 0);
  }

  /** 資產／負債各一段：小標題、然後每個類型一張卡。 */
  function section(title: string, kind: AccountKind) {
    const groups = typeGroups(kind);
    if (groups.length === 0) return null;
    return (
      <div>
        <div className="mb-2 px-1">
          <p className={text.sectionHeading}>{title}</p>
        </div>
        <div className="flex flex-col gap-3">
          {groups.map(({ type, accounts: typeAccounts, amount, total, pct }) => {
            // 一個類型底下只有一個帳戶、而且名字跟類型一樣（「銀行帳戶」類型底下就一個
            // 叫「銀行帳戶」的帳戶，這是最常見的情況）時不列子項目——同一個名字、同一個
            // 金額寫兩次只是把卡片變高。這時整個類型列就代表那一個帳戶，點它直接進那個
            // 帳戶的明細。
            const soloAccount = typeAccounts.length === 1 && typeAccounts[0].name === type.name ? typeAccounts[0] : null;
            const row = (
              <div className="flex w-full items-center gap-3 px-4 py-3.5">
                <ListProgressRow
                  icon={type.icon}
                  iconClassName={accountTypeColorClass(accountTypes, type.id)}
                  name={type.name}
                  amount={`${formatCurrency(amount)} / ${formatCurrency(total)}`}
                  pct={pct}
                  barColorClass={categoryFillClass[type.color]}
                />
              </div>
            );
            return (
              <div key={type.id} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {/* 有列出子帳戶時，類型這一列本身不能點：類型的名稱／圖示／顏色一律在
                    「設定 › 帳戶類型」改，這一頁只負責看數字，能點的是底下那幾個帳戶。 */}
                {soloAccount ? (
                  <Link href={`/tools/expenses/assets/${soloAccount.id}`} className="block">
                    {row}
                  </Link>
                ) : (
                  <>
                    {row}
                    <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
                      {typeAccounts.map((a) => (
                        <ListRow
                          key={a.id}
                          href={`/tools/expenses/assets/${a.id}`}
                          name={a.name}
                          right={
                            <span className={`tabular-nums font-semibold ${kind === "liability" ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>
                              {kind === "liability" ? "－" : ""}
                              {formatCurrency(balanceOf(a))}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 新增帳戶在右下角的浮動按鈕（跟首頁新增交易同一招）。「帳戶類型」不放這裡：從
          設定頁 › 帳戶與資產 進去就好，同一個入口不用開兩個。
          「轉帳」回到頁首右邊：它動的是整頁所有帳戶之間的錢，不是只動「資產」那一段
          （信用卡還款的轉入端是負債帳戶），掛在某一段的小標旁邊會讀成「這一段的操作」。
          文字鈕換成線條 SVG 圖示，跟日期膠囊、眼睛那顆同一組視覺（見 line-icon-button.tsx）。 */}
      <PageHeader
        title="資產總表"
        actions={
          <LineIconButton
            icon="transfer"
            aria-label="新增轉帳"
            title={accounts.length < 2 ? "至少要有兩個帳戶才能轉帳" : "新增轉帳"}
            disabled={accounts.length < 2}
            onClick={() => setTransferOpen(true)}
          />
        }
      />

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

      {/* 編輯既有的一筆轉帳，跟上面「新增」那個是兩個實例：initial 不一樣，而且 key 要
          跟著那一筆的 id 換，不然連續點兩列會沿用前一筆的表單狀態。 */}
      <TransferModal
        key={transferEdit ? transferEdit.id : "transfer-edit-closed"}
        open={transferEdit !== null}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        initial={transferEdit ?? undefined}
        onClose={() => setTransferEdit(null)}
        onSave={handleEditTransfer}
        onDelete={handleDeleteTransfer}
      />

      {/* 月份在最上面：這一整頁（淨資產、各類型佔比、每個帳戶的餘額）講的都是「那個月
          月底當時」的數字，不是只有某一塊會跟著換。 */}
      <div className="mb-4">
        <label className="flex flex-col gap-1.5">
          <span className={text.label}>月份</span>
          <DateField value={yearMonth} onChange={setYearMonth} granularity="month" />
        </label>
      </div>

      {ready && accounts.length > 0 && (
        <div className="mb-5 flex flex-col gap-3">
          <Card>
            <CardBody>
              <p className={text.muted}>{yearMonth} 淨資產</p>
              <div className="mt-0.5 flex items-end justify-between">
                <p className="text-2xl font-bold tabular-nums text-[#4A3B7C]">
                  {net < 0 ? "－" : ""}
                  {formatCurrency(Math.abs(net))}
                </p>
                <span className={`text-xs font-semibold ${net < 0 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{netPct}%</span>
              </div>
              {/* 條子走「淨資產佔資產多少」：愈滿代表欠得愈少。 */}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3EFFC]">
                <div
                  className={`h-full rounded-full ${net < 0 ? "bg-[#D1517E]" : "bg-[#6F5FD6]"}`}
                  style={{ width: `${Math.min(100, Math.max(netPct, 0))}%` }}
                />
              </div>
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
            {/* 轉帳明細的小標右邊沒有連結，所以 action={false}——留一條假的灰條在那裡，
                資料回來那個位置會空掉。 */}
            <GroupedSectionSkeleton shape={transferSkeletonShape} action={false} />
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶，點右下角的＋新增第一個</p>
      ) : (
        // 依「帳戶類型」分組：每個類型一列（金額＋佔同類型總額的進度條，本來在設定頁的
        // 帳戶類型那一頁），它底下的帳戶列在同一張卡裡。這樣「這類資產佔我多少」跟
        // 「這類底下是哪幾個戶頭」在同一個畫面上看得到，不用在兩頁之間來回對照。
        <div className="flex flex-col gap-5">
          {section("資產", "asset")}
          {section("負債", "liability")}

          {/* 轉帳明細擺在資產／負債底下：上面兩段是「現在有多少」，這一段是「錢最近在
              哪兩個帳戶之間搬」，看完結論才看動作。版面刻意跟首頁的「最近消費」一模
              一樣（日期小標＋當天小計、底下一張卡列那天幾筆、超過五筆收起來），兩個
              地方都是「依日期排的流水明細」，不要有兩套長相。 */}
          <div>
            <div className="mb-2 px-1">
              <p className={text.sectionHeading}>轉帳明細</p>
            </div>
            {transferGroups.length === 0 ? (
              <EmptyListCard>還沒有任何轉帳紀錄，點右上角的圖示新增</EmptyListCard>
            ) : (
              <>
                <div className="flex flex-col gap-5">
                  {visibleTransferGroups.map(([date, items]) => (
                    <div key={date}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                        <p className={`font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
                        <p className={`font-medium tabular-nums ${text.muted}`}>{formatCurrency(transferDayTotals.get(date) ?? 0)}</p>
                      </div>
                      <ListCard>
                        {items.map((t) => (
                          // 點一列就開轉帳彈窗改那一筆——轉帳沒有自己的明細頁（欄位就那四個）。
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTransferEdit(t)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left"
                          >
                            {/* 標題是備註（沒寫就「轉帳」兩個字）、副標是「從哪 → 到哪」，
                                跟帳戶明細頁那一列同一種分工（標題是這筆是什麼、副標是它
                                歸在哪裡）。這一頁不限定單一帳戶，所以副標兩邊都寫出來。 */}
                            <TransactionRowLabel
                              icon={ICON_PATHS.accountTransfer}
                              title={t.note || "轉帳"}
                              subtitle={`${accountNameOf(t.fromAccountId)} → ${accountNameOf(t.toAccountId)}`}
                            />
                            {/* 金額不帶正負號：轉帳對一邊是減、對另一邊是加，整體沒有增減，
                                掛個「－」會讓人以為錢變少了。顏色用品牌紫跟支出的深紫、
                                收入的綠分開。 */}
                            <span className="shrink-0 tabular-nums font-semibold text-[#6F5FD6]">{formatCurrency(t.amount)}</span>
                          </button>
                        ))}
                      </ListCard>
                    </div>
                  ))}
                </div>
                {transferCount > PREVIEW_COUNT && (
                  <ExpandToggle
                    expanded={transfersExpanded}
                    total={transferCount}
                    onToggle={() => setTransfersExpanded((v) => !v)}
                    label="顯示近一個月"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
