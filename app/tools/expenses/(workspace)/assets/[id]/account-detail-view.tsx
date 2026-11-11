"use client";

import { useState } from "react";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { useBulkEdit } from "@/components/expenses/use-bulk-edit";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/expenses/page-header";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { SegmentedControl } from "@/components/expenses/button";
import { BackLink } from "@/components/expenses/back-link";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { text } from "@/components/expenses/theme";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { TransferModal, type TransferModalDraft } from "@/components/expenses/transfer-modal";
import { SelectField } from "@/components/expenses/select-field";
import { Field } from "@/components/expenses/modal";
import { AccountPickerModal } from "@/components/expenses/account-picker-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { useBusy } from "@/components/expenses/busy";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { ReconcileModal } from "@/components/expenses/reconcile-modal";
import { BreakdownToggle, TransactionBreakdown } from "@/components/expenses/transaction-breakdown";
import { dateFilterRange } from "@/lib/expenses/date-filter";
import { categoryById, categoryColorClass, categoryPath, type CategoryDTO } from "@/lib/expenses/categories";
import { totalsForRange, transactionDisplayName, type TransactionDTO } from "@/lib/expenses/transactions";
import { inDateRange } from "@/lib/expenses/date-filter";
import { accountBalance, transactionBalancesByAccount, type AccountDTO, type AccountUsage } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { transfersForAccount, type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

type TxModalState = { mode: "create" } | { mode: "edit"; transaction: TransactionDTO };

/** 單一帳戶的明細頁。五份資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」
 *  這個狀態，也不需要骨架。五份都放進 state——這一頁可以改帳戶本身、改交易、改轉帳，
 *  彈窗裡還能順手新增帳戶類型跟分類，每一種都會動到其中一份。 */
export function AccountDetailView({
  accountId,
  initialAccounts,
  initialAccountTypes,
  initialCategories,
  initialTransactions,
  initialTransfers,
}: {
  accountId: string;
  initialAccounts: AccountDTO[];
  initialAccountTypes: AccountTypeDTO[];
  initialCategories: CategoryDTO[];
  initialTransactions: TransactionDTO[];
  initialTransfers: TransferDTO[];
}) {
  const router = useRouter();
  const runBusy = useBusy();
  const { filter } = useDateFilter();
  const showToast = useToast();
  const showDeleteToast = useUndoDelete();
  const [accounts, setAccounts] = useState<AccountDTO[]>(initialAccounts);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>(initialAccountTypes);
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const [transactions, setTransactions] = useState<TransactionDTO[]>(initialTransactions);
  const [transfers, setTransfers] = useState<TransferDTO[]>(initialTransfers);
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ inUseCount: number; usage?: AccountUsage } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<string[] | null>(null);
  // 哪幾筆的明細是展開的——預設全部收起來，只有有明細的那幾筆才看得到展開箭頭。
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
      const data: { inUseCount?: number; usage?: AccountUsage } = await res.json().catch(() => ({}));
      setEditOpen(false);
      setDeleteConfirm({ inUseCount: data.inUseCount ?? 0, usage: data.usage });
      return;
    }
    const data: { trashId?: string } = (await res?.json().catch(() => ({}))) ?? {};
    // 刪完會離開這一頁，所以復原之後用 refresh 讓資產總表重新讀——這一頁的 state
    // 已經不在了，沒有東西可以就地更新。
    showDeleteToast(data.trashId, () => router.refresh());
    router.push("/tools/expenses/assets");
  }

  async function handleForceDeleteAccount() {
    const data: { trashId?: string } = await fetch(`/api/expenses/accounts?id=${accountId}&force=1`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => ({}));
    showDeleteToast(data.trashId, () => router.refresh());
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
    const data: { transactions?: TransactionDTO[]; trashId?: string } = await runBusy("刪除中…", () =>
      fetch(`/api/expenses/transactions?id=${txModal.transaction.id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({})),
    );
    if (data.transactions) setTransactions(data.transactions);
    showDeleteToast(data.trashId, async () => {
      const fresh: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions").then((r) => r.json());
      if (fresh.transactions) setTransactions(fresh.transactions);
    });
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
    // 手續費會另外生出／刪掉一筆支出交易（見 transfers.server.ts），而這一頁的
    // transactions 是 page.tsx 傳進來的，setTransfers 更新不到——不重抓的話餘額會少算
    // 那筆手續費。有填過手續費（改之前或改之後）才重抓。
    if (draft.fee || transferModal.fee) router.refresh();
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
    const data: { transfers?: TransferDTO[]; trashId?: string } = await runBusy("刪除中…", () =>
      fetch(`/api/expenses/transfers?id=${transferModal.id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({})),
    );
    if (data.transfers) setTransfers(data.transfers);
    showDeleteToast(data.trashId, async () => {
      const fresh: { transfers?: TransferDTO[] } = await fetch("/api/expenses/transfers").then((r) => r.json());
      if (fresh.transfers) setTransfers(fresh.transfers);
    });
    setTransferModal(null);
  }

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

  // 只有一般交易能被選：轉帳沒有分類、而「改帳戶」對它來說是改轉出或轉入哪一邊，
  // 跟批次改一批交易不是同一件事（要改就點開那一筆自己改）。
  const selectableTx = visibleEntries.flatMap((e) => (e.kind === "tx" ? [e.tx] : []));
  const selection = useSelection(selectableTx.map((t) => t.id));
  // 這一頁支出收入混排，所以「選到的那批是哪一種」要自己算；兩種都有就傳 null，
  // 改分類會擋下來講原因（見 useBulkEdit）。
  const selectedKinds = new Set(
    selectableTx.filter((t) => selection.selectedIds.has(t.id)).map((t) => (categoryById(categories, t.categoryId)?.kind === "收入" ? "收入" : "支出")),
  );
  // 跟明細頁共用同一套「改帳戶／改分類」：兩邊列的都是交易，操作當然該一模一樣。
  const bulkEdit = useBulkEdit({
    transactions,
    categories,
    accounts,
    accountTypes,
    transfers,
    selectedIds: selection.selectedIds,
    kind: selectedKinds.size === 1 ? ([...selectedKinds][0] as "支出" | "收入") : null,
    onUpdated: setTransactions,
    onDone: selection.exit,
  });

  // 逐筆依序 DELETE：API 一次只收一個 id，每次都回傳最新的完整清單，照順序打完最後
  // 那一份就是對的（併發送出的話回傳順序不保證，可能拿到中間狀態）。
  async function handleBulkDelete() {
    await runBusy("刪除中…", () => bulkDelete());
  }

  async function bulkDelete() {
    let latest = transactions;
    const trashIds: (string | undefined)[] = [];
    for (const id of selection.selectedIds) {
      const data: { transactions?: TransactionDTO[]; trashId?: string } = await fetch(`/api/expenses/transactions?id=${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.transactions) latest = data.transactions;
      trashIds.push(data.trashId);
    }
    setTransactions(latest);
    showDeleteToast(
      trashIds,
      async () => {
        const fresh: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions").then((r) => r.json());
        if (fresh.transactions) setTransactions(fresh.transactions);
      },
      `已刪除 ${selection.selectedIds.size} 筆`,
    );
    setBulkDeleteConfirm(null);
    selection.exit();
  }
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
  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/tools/expenses/assets" label="返回帳戶總表" />
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
        <SelectField value={account.name} placeholder="選擇帳戶" aria-label="切換帳戶" chevron onClick={() => setSwitchOpen(true)} />
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

      {bulkEdit.element}

      <ConfirmModal
        open={bulkDeleteConfirm !== null}
        title={`刪除 ${bulkDeleteConfirm?.length ?? 0} 筆紀錄`}
        message={`確定要刪除選取的紀錄嗎？${TRASH_RESTORE_NOTE}`}
        confirmLabel="刪除"
        onClose={() => setBulkDeleteConfirm(null)}
        onConfirm={handleBulkDelete}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="這個帳戶還有東西掛著"
        // 一行一種，各自講自己的後果——全部混成一句「還有 N 筆紀錄」的話，使用者判斷
        // 不了該不該刪（被暫停的固定收支跟一筆會變成「不指定」的交易，嚴重程度差很多）。
        message={
          <>
            刪除之後：
            <span className="mt-2 block">
              {[
                deleteConfirm?.usage?.transactions ? `${deleteConfirm.usage.transactions} 筆交易會變成「不指定帳戶」，紀錄本身不會被刪掉` : "",
                deleteConfirm?.usage?.transfers ? `${deleteConfirm.usage.transfers} 筆轉帳會留著，但其中一端會顯示「已刪除帳戶」` : "",
                deleteConfirm?.usage?.categories ? `${deleteConfirm.usage.categories} 個分類的預設帳戶會失效` : "",
                deleteConfirm?.usage?.goals ? `${deleteConfirm.usage.goals} 個綁著這個帳戶的存錢目標，進度會變成 0` : "",
                deleteConfirm?.usage?.transferRules
                  ? `${deleteConfirm.usage.transferRules} 條轉帳型的固定收支會被暫停（不然每一期都會轉到一個不存在的帳戶）`
                  : "",
              ]
                .filter(Boolean)
                .map((line) => (
                  <span key={line} className="block">
                    ・{line}
                  </span>
                ))}
            </span>
            <span className="mt-2 block">{TRASH_RESTORE_NOTE}還原帳戶之後，上面這些會自動接回去（被暫停的固定收支要自己按恢復）。</span>
          </>
        }
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
          {/* 釘在卡片頂端（含底下的選取工具列）。這裡在白色卡片裡面，所以不用
              StickyToolbar——那個的底色跟左右外距是照頁面層級的紫底、20px 留白設計的，
              放進 p-4 的卡片裡會凸出去。自己用卡片的白底跟 16px 外距。 */}
          <div className="sticky top-0 z-20 -mx-4 -mt-4 flex flex-col gap-3 bg-white px-4 pb-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={text.sectionHeading}>明細</p>
            <div className="flex items-center gap-2">
              <SegmentedControl
                value={transfersOnly ? "transfer" : "all"}
                onChange={(v) => setTransfersOnly(v === "transfer")}
                activeTone="solid"
                options={[
                  { value: "all", label: "全部" },
                  { value: "transfer", label: "只看轉帳" },
                ]}
              />
              {/* 只看轉帳的時候一筆都選不到，按鈕就不出現——擺一顆按了只會得到空工具列
                  的按鈕，比沒有更讓人困惑。 */}
              {!transfersOnly && <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} pendingConfirm={bulkEdit.pending?.onConfirm} />}
            </div>
          </div>

          {selection.selecting && (
            <SelectionBar
              count={selection.selectedIds.size}
              total={selection.total}
              actions={bulkEdit.actions}
              pending={bulkEdit.pending}
              onToggleAll={selection.toggleAll}
              onCancel={selection.exit}
              onDelete={() => setBulkDeleteConfirm([...selection.selectedIds])}
            />
          )}
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
                              {/* 選取模式時整一列就是一個勾選目標（圓點只是指示器，點它
                                  本身沒有事件）——跟明細頁同一個做法。 */}
                              <button
                                type="button"
                                role={selection.selecting ? "checkbox" : undefined}
                                aria-checked={selection.selecting ? selection.selectedIds.has(t.id) : undefined}
                                onClick={() => (selection.selecting ? selection.toggle(t.id) : setTxModal({ mode: "edit", transaction: t }))}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              >
                                {selection.selecting && <SelectionDot selected={selection.selectedIds.has(t.id)} />}
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
                              {/* 選取模式時不顯示展開箭頭：正在挑要改哪幾筆的時候不會想
                                  展開看拆帳明細，留著它等於在勾選範圍右邊挖一個點不到的洞。 */}
                              {!selection.selecting && breakdown.length > 0 && (
                                <BreakdownToggle expanded={expanded} onClick={() => toggleExpanded(t.id)} />
                              )}
                            </div>
                            {!selection.selecting && expanded && breakdown.length > 0 && <TransactionBreakdown items={breakdown} />}
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
                          disabled={selection.selecting}
                          onClick={() => setTransferModal(transfer)}
                          // 選取模式下轉帳列選不到（沒有分類、帳戶也不是同一個意思），
                          // 淡掉表示「這幾列現在不參與」，而不是讓它看起來點了沒反應。
                          className={`flex w-full items-center gap-3 px-3 py-3 text-left ${selection.selecting ? "opacity-40" : ""}`}
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
