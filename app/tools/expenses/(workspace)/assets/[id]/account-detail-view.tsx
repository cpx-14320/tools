"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/expenses/page-header";
import { CardSkeleton, DateGroupsSkeleton, PageHeaderSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
import { useSkeletonReady, useSkeletonShape } from "@/components/expenses/skeleton-count";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { SegmentedControl } from "@/components/expenses/button";
import { BackLink } from "@/components/expenses/back-link";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { text } from "@/components/expenses/theme";
import { TOAST, useToast } from "@/components/expenses/toast";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { SelectField } from "@/components/expenses/select-field";
import { Field } from "@/components/expenses/modal";
import { AccountPickerModal } from "@/components/expenses/account-picker-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { ReconcileModal } from "@/components/expenses/reconcile-modal";
import { BreakdownToggle, TransactionBreakdown } from "@/components/expenses/transaction-breakdown";
import { dateFilterRange } from "@/lib/expenses/date-filter";
import { categoryById, categoryColorClass, categoryPath, type CategoryDTO } from "@/lib/expenses/categories";
import { totalsForRange, transactionDisplayName, type TransactionDTO } from "@/lib/expenses/transactions";
import { inDateRange } from "@/lib/expenses/date-filter";
import { accountBalance, transactionBalancesByAccount, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { transfersForAccount, type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

type TxModalState = { mode: "create" } | { mode: "edit"; transaction: TransactionDTO };

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { filter } = useDateFilter();
  const showToast = useToast();
  const skeletonReady = useSkeletonReady();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  // 換帳戶：點上面那顆下拉欄位開帳戶選擇彈窗，選了直接換到那個帳戶的明細頁。
  const [switchOpen, setSwitchOpen] = useState(false);
  // 明細只看轉帳——這一頁本來就是「這個戶頭的錢怎麼進出」，要找某一筆轉帳時在混排的
  // 流水裡用眼睛撈很慢。消費細項要看分類、佔比、趨勢一律去明細頁或報表頁，那邊做得完整。
  const [transfersOnly, setTransfersOnly] = useState(false);
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
    showToast(TOAST.saved);
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
    showToast(TOAST.deleted);
    router.push("/tools/expenses/assets");
  }

  async function handleForceDeleteAccount() {
    await fetch(`/api/expenses/accounts?id=${accountId}&force=1`, { method: "DELETE" }).catch(() => {});
    showToast(TOAST.deleted);
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
    showToast(txModal.mode === "edit" ? TOAST.saved : TOAST.created);
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
    showToast(TOAST.created);
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
    showToast(TOAST.deleted);
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
    showToast(TOAST.saved);
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
    showToast(TOAST.deleted);
    setTransferModal(null);
  }

  // ── 明細的分組推導刻意放在早期 return 之前 ──────────────────────────────────
  // 骨架要照「上次明細有幾組、每組幾列」來畫，記形狀的 useSkeletonShape 是 hook，不能
  // 擺在 return 後面。帳戶還沒載到（accounts 還是空的）時這一段一律算在空陣列上，算完
  // 的結果不會被用到，成本也只是幾個空陣列。
  const range = dateFilterRange(filter);
  const accountTx = account ? transactions.filter((t) => t.accountId === account.id) : [];
  // 只拿這段期間的收入／支出交易來組明細，總額本身不用——「這段期間進出多少」改成
  // 從明細逐筆加總（含轉帳），見 periodIn／periodOut。
  const { expenseTx, incomeTx } = totalsForRange(accountTx, categories, range);
  const accountTransfers = account ? transfersForAccount(transfers, account.id).filter((t) => inDateRange(t.date, range)) : [];

  // 「明細」要把一般交易跟轉帳混在同一個依日期分組的列表裡——轉帳不是支出也不是收入，
  // 但使用者翻帳戶明細時仍然要看得到錢是什麼時候被轉走/轉進來的。
  type DetailEntry = { date: string } & ({ kind: "tx"; tx: TransactionDTO } | { kind: "transfer"; transfer: TransferDTO });
  const entries: DetailEntry[] = [
    ...[...expenseTx, ...incomeTx].map((tx): DetailEntry => ({ kind: "tx", date: tx.date, tx })),
    ...accountTransfers.map((transfer): DetailEntry => ({ kind: "transfer", date: transfer.date, transfer })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const visibleEntries = transfersOnly ? entries.filter((e) => e.kind === "transfer") : entries;
  const groups = new Map<string, DetailEntry[]>();
  for (const e of visibleEntries) {
    const list = groups.get(e.date) ?? [];
    list.push(e);
    groups.set(e.date, list);
  }
  /** 一筆明細對這個帳戶的增減——正號是進來的錢（收入、轉入），負號是出去的（支出、轉出）。
   *
   *  刻意不套資產/負債的正負號規則（accounts.ts 的 signedDelta 會把負債帳戶的支出算成
   *  「欠款增加」）：列表上每一列顯示的就是「錢進來還是出去」，上面的小計要跟底下加得
   *  起來才有意義。 */
  function entryDelta(e: DetailEntry): number {
    if (e.kind === "transfer") return e.transfer.toAccountId === account?.id ? e.transfer.amount : -e.transfer.amount;
    return categoryById(categories, e.tx.categoryId)?.kind === "收入" ? e.tx.amount : -e.tx.amount;
  }

  /** 某一天的淨變動。 */
  function dayNet(items: DetailEntry[]): number {
    return items.reduce((sum, e) => sum + entryDelta(e), 0);
  }

  // 這段期間這個帳戶「進了多少、出了多少」——含轉帳，所以跟底下的明細加得起來。
  // 本來那三張 KPI 卡（收入／支出／結餘）只算交易、不含轉帳，數字跟明細對不上；而且
  // 「這個帳戶這段期間收入多少」本身也不是會拿來做決定的數字，分類佔比、趨勢那些報表頁
  // 做得完整得多。收斂成餘額卡裡的一行。
  const periodIn = entries.reduce((sum, e) => {
    const v = entryDelta(e);
    return v > 0 ? sum + v : sum;
  }, 0);
  const periodOut = entries.reduce((sum, e) => {
    const v = entryDelta(e);
    return v < 0 ? sum - v : sum;
  }, 0);

  const detailSkeletonShape = useSkeletonShape(
    "cpx-tools:expenses-skeleton:account-detail",
    [3, 2],
    ready && account ? [...groups.values()].map((items) => items.length) : undefined,
  );

  // 骨架等掛載後才畫：明細的組數只有瀏覽器讀得到（localStorage），伺服器端畫出來的
  // 一定是預設值，不擋的話會先閃一次錯的形狀再換成記住的（見 useSkeletonReady）。
  if (!skeletonReady) return null;

  if (!ready) {
    // 骨架照著載入完成後的版面排：標題＋日期＋鉛筆、換帳戶欄位、餘額卡（含「這段期間
    // 進出多少」那一行跟對帳鈕）、明細卡。這一頁本來只寫一行「載入中…」，資料回來整頁
    // 一次長出來，畫面會從一行字暴衝成滿滿一頁。
    // 這裡沒有返回鍵——標題右邊的返回鍵已經移除了，骨架留著的話載入完成那一刻會多消失
    // 一顆東西。要回總表走底部導覽列的「資產」。
    return (
      <div className="flex flex-col gap-4">
        <PageHeaderSkeleton titleWidth={120} />
        <div>
          <SkeletonBar width={56} height={16} />
          <div className="mt-1.5 h-[42px] animate-pulse rounded-2xl bg-[#EDE6FB]" />
        </div>
        <CardSkeleton className="py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <SkeletonBar width={56} height={16} />
              <SkeletonBar width={148} height={28} className="mt-0.5" />
            </div>
            <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-[#EDE6FB]" />
          </div>
          {/* 「這段期間 進 ＋◯ 出 －◯」那一行。 */}
          <div className="mt-2">
            <SkeletonBar width={220} height={16} />
          </div>
          <div className="mt-3 h-[34px] animate-pulse rounded-xl bg-[#EDE6FB]" />
        </CardSkeleton>
        <CardSkeleton>
          {/* 明細的標題列右邊有「全部／只看轉帳」那組切換（h-9 ＝ 36px）。 */}
          <div className="flex items-center justify-between gap-2">
            <SkeletonBar width={48} height={20} />
            <div className="h-9 w-[124px] animate-pulse rounded-full bg-[#EDE6FB]" />
          </div>
          <div className="mt-3">
            <DateGroupsSkeleton shape={detailSkeletonShape} />
          </div>
        </CardSkeleton>
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
  const kind = accountTypeById(accountTypes, account.accountTypeId)?.kind ?? "asset";
  const currentBalance = accountBalance(account, accountTypes, transactions, categories, transfers);
  // 每一筆交易／轉帳「發生後」這個帳戶變成多少——跟上面的日期篩選器無關，一律用全部
  // 資料算，不然篩選器切到別的區間時，顯示出來的「交易後餘額」會跟著篩選範圍錯亂。
  const accountBalances = transactionBalancesByAccount(accounts, accountTypes, transactions, categories, transfers);

  return (
    <div className="flex flex-col gap-4">
      {/* 標題底下不再重複「圖示＋類型名稱」：類型的圖示就掛在下面那張餘額卡的右上角，
          而且多數帳戶跟它的類型同名（新增帳戶會自動帶類型名），等於把同一個詞寫兩次。 */}
      {/* 標題右邊只剩鉛筆：返回鍵拿掉了。要換看別的帳戶改用下面那顆下拉欄位（不用先退回
          總表再點進來），要回總表底部導覽列的「資產」就是同一個去處。
          鉛筆走 Font Awesome，不用 emoji ✏️——emoji 在不同系統長得不一樣，也吃不到品牌紫。
          規格比照搭乘車那顆（見 icon-button.tsx）。 */}
      <PageHeader
        title={account.name}
        actions={
          <DateFilterPicker
            actions={<LineIconButton icon="pen" aria-label="編輯帳戶資料" onClick={() => setEditOpen(true)} />}
          />
        }
      />

      {/* 換帳戶的下拉欄位，擺在餘額卡上面：這一頁所有數字都是「這個帳戶的」，先講清楚
          現在看的是哪一個，再往下看數字。長相跟彈窗裡的帳戶欄位一致（SelectField），
          點了開的也是同一個 AccountPickerModal——那份清單本來就列了每個帳戶的餘額，
          等於順手看得到別的戶頭現在有多少。 */}
      <Field label="切換資產">
        <SelectField value={account.name} placeholder="選擇帳戶" aria-label="切換帳戶" onClick={() => setSwitchOpen(true)} />
      </Field>

      <AccountPickerModal
        open={switchOpen}
        title="切換帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        value={accountId}
        allowUnset={false}
        onClose={() => setSwitchOpen(false)}
        onSelect={(id) => {
          // 選到的就是現在這一頁時不用換頁，免得多一次沒必要的導覽。
          if (id && id !== accountId) router.push(`/tools/expenses/assets/${id}`);
        }}
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
        key={txModal ? JSON.stringify(txModal) : "tx-closed"}
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
        key={transferModal ? transferModal.id : "transfer-closed"}
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
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${kind === "liability" ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>
                {formatCurrency(currentBalance)}
              </p>
            </div>
            <IconAvatar icon={type?.icon ?? "❓"} className={type ? categoryColorClass[type.color] : undefined} />
          </div>
          {/* 餘額是從交易即時加總出來的，漏記一筆就會跟實際差一輩子——對帳讓使用者輸入
              真正的餘額，差額補成一筆調整交易，不用回頭翻整份紀錄找是哪裡少記。 */}
          {/* 這段期間進出多少——一行講完，取代原本三張 KPI 卡。說「進／出」而不是
              「收入／支出」：轉帳也算在裡面，它既不是收入也不是支出，但確實是錢進出
              這個戶頭。 */}
          <p className={`mt-2 ${text.muted}`}>
            這段期間 進 <span className="font-medium tabular-nums text-[#2FAE82]">＋{formatCurrency(periodIn)}</span> 出{" "}
            <span className="font-medium tabular-nums text-[#D1517E]">－{formatCurrency(periodOut)}</span>
          </p>
          <button
            type="button"
            onClick={() => setReconcileOpen(true)}
            className="mt-3 w-full rounded-xl border border-[#ECE4FA] py-2 text-xs font-medium text-[#6F5FD6]"
          >
            核對{kind === "liability" ? "欠款" : "餘額"}
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

      <Card>
        <CardBody>
          {/* 這一頁的重點就是明細，所以篩選直接放在標題旁邊——轉帳混在支出收入裡不好找，
              而且這一頁本來就是最常拿來核對轉帳的地方。 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={text.sectionHeading}>明細</p>
            <SegmentedControl
              value={transfersOnly ? "transfer" : "all"}
              onChange={(v) => setTransfersOnly(v === "transfer")}
              activeTone="solid"
              options={[
                { value: "all", label: "全部" },
                { value: "transfer", label: "只看轉帳" },
              ]}
            />
          </div>
          {visibleEntries.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>
              {transfersOnly ? "這段期間這個帳戶沒有轉帳紀錄。" : "這段期間這個帳戶還沒有掛任何交易或轉帳。"}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {[...groups.entries()].map(([date, items]) => (
                <div key={date}>
                  {/* 日期標頭比照首頁「最近消費」跟消費紀錄頁：日期帶星期幾、右邊掛當天
                      小計。這一頁的明細混了支出、收入跟轉帳，所以小計是「這一天這個帳戶
                      淨進出多少」，正負號跟底下每一列一致（見 dayNet）。 */}
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                    <p className={`font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
                    {/* 跟左邊的日期同一個字級字色——當天小計是標頭資訊，不跟下面每一列的
                        金額搶眼睛。 */}
                    <p className={`font-medium tabular-nums ${text.muted}`}>
                      {dayNet(items) >= 0 ? "＋" : "－"}
                      {formatCurrency(Math.abs(dayNet(items)))}
                    </p>
                  </div>
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
                        // 轉帳列跟支出／收入列的區隔只靠標題前面那個「轉帳」標籤跟金額的
                        // 顏色——左邊的豎條跟整列的淡紫底拿掉了，它們在一條依日期排的流水
                        // 裡太重，每隔幾列就橫插一條色帶，反而是色帶在搶視線而不是內容。
                        <button
                          key={transfer.id}
                          type="button"
                          onClick={() => setTransferModal(transfer)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left"
                        >
                          {/* 標題放備註、副標放「轉到／來自 哪個帳戶」——跟上面的交易列
                              一致（標題是這筆是什麼、副標是它歸在哪裡）。沒寫備註的話
                              標題就只剩那顆膠囊，不用再補「轉帳」兩個字跟它重複。 */}
                          <TransactionRowLabel
                            icon={ICON_PATHS.accountTransfer}
                            title={
                              <span className="flex items-center gap-1.5">
                                {/* 純文字標籤，沒有底色也沒有圓角——字級字重跟旁邊的標題
                                    一樣（text-sm font-medium，見 TransactionRowLabel），
                                    只有顏色不同。膠囊那種實心小方塊在一列裡太像一顆按鈕。 */}
                                <span className="shrink-0 text-[#6F5FD6]">轉帳</span>
                                {transfer.note && <span className="min-w-0 truncate">{transfer.note}</span>}
                              </span>
                            }
                            subtitle={`${isOutgoing ? "轉到" : "來自"} ${otherAccount?.name ?? "（未知帳戶）"}`}
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
