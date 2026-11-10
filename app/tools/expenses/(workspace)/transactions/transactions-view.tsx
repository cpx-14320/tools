"use client";

import { useState } from "react";
import { FaIcon } from "@/components/expenses/fa-icon";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { useBusy } from "@/components/expenses/busy";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { ListCard } from "@/components/expenses/list-row";
import { OptionGrid } from "@/components/expenses/option-grid";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { PageHeader } from "@/components/expenses/page-header";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { useBulkEdit } from "@/components/expenses/use-bulk-edit";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { AiEntryButton } from "@/components/expenses/ai/ai-entry-button";
import { BreakdownToggle, TransactionBreakdown } from "@/components/expenses/transaction-breakdown";
import { dateFilterRange } from "@/lib/expenses/date-filter";
import { Modal, ModalFooter, fieldInputClass } from "@/components/expenses/modal";
import {
  categoryById,
  categoryColorClass,
  categoryPath,
  topLevelCategories,
  topLevelCategoryId,
  type CategoryDTO,
  type CategoryKind,
} from "@/lib/expenses/categories";
import {
  totalsForRange,
  transactionDisplayName,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

function matchesQuery(t: TransactionDTO, categories: CategoryDTO[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [t.note, categoryPath(categories, t.categoryId), t.date].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

/** 消費紀錄頁。資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，
 *  也不需要骨架。 */
export function TransactionsView({
  initialCategories,
  initialTransactions,
  /** 這三份只用來顯示帳戶名稱／圖示跟混進轉帳列，這一頁不會改它們。 */
  accounts,
  accountTypes,
  transfers,
  aiEnabled,
}: {
  initialCategories: CategoryDTO[];
  initialTransactions: TransactionDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transfers: TransferDTO[];
  /** 要不要顯示 AI 記帳的入口（見 lib/expenses/settings.server.ts）。 */
  aiEnabled: boolean;
}) {
  const { filter } = useDateFilter();
  // 首頁那幾個區塊的「查看全部」會帶 ?kind=收入 過來、點某一類的列會再多帶
  // &categoryId=xxx，直接幫使用者切到對的分頁並且篩好分類，不用進來之後再點一次。
  const searchParams = useSearchParams();
  const initialKind: CategoryKind = searchParams.get("kind") === "收入" ? "收入" : "支出";
  // ?month=YYYY-MM 不在這裡處理——它要在伺服器算繪的那一輪就生效，所以讀的地方是
  // DateFilterProvider 的 useState 初始值（見 date-filter-context.tsx）。
  const showToast = useToast();
  const runBusy = useBusy();
  const showDeleteToast = useUndoDelete();
  // 編輯交易的彈窗裡可以順手建一個新分類（onCategoriesChange），所以分類要是 state。
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const [transactions, setTransactions] = useState<TransactionDTO[]>(initialTransactions);
  const [query, setQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  // 只看某一個大分類（含它的子分類）的篩選，空字串＝全部分類。
  // 只看哪幾個大分類（含各自的子分類）；空陣列＝全部。複選而不是單選——「這個月餐飲
  // 加交通總共花多少」這種問題，單選一次只能看一邊，得自己把兩個數字加起來。
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  // 金額區間篩選（字串是因為使用者可能只填一邊）——翻舊帳時「我記得那筆大概一兩萬」
  // 比關鍵字好用，備註常常根本沒打。
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  // 哪幾筆的明細是展開的——預設全部收起來，只有有明細的那幾筆才看得到展開箭頭。
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 這頁現在只處理既有紀錄的編輯（新增交易改到首頁的浮動按鈕），所以只需要存「正在編輯
  // 哪一筆」，不用再分 create/edit 兩種模式。
  const [modal, setModal] = useState<TransactionDTO | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const isSearching = query.trim().length > 0;
  const range = dateFilterRange(filter);

  const inKind = (t: TransactionDTO) => (categoryById(categories, t.categoryId)?.kind ?? "支出") === kind;
  const totals = totalsForRange(transactions, categories, range);

  // 分類篩選比對的是「頂層分類」，所以選「餐飲」時連它底下的子分類（早餐…）也會留下來。
  const inCategoryFilter = (t: TransactionDTO) =>
    categoryFilters.length === 0 || categoryFilters.includes(topLevelCategoryId(categories, t.categoryId));

  // 空字串＝那一邊不設限；填了不是數字的東西也當成沒設限，不要讓清單忽然全空。
  const minNum = Number(minAmount);
  const maxNum = Number(maxAmount);
  const hasMin = minAmount.trim() !== "" && Number.isFinite(minNum);
  const hasMax = maxAmount.trim() !== "" && Number.isFinite(maxNum);
  const inAmountFilter = (t: TransactionDTO) => (!hasMin || t.amount >= minNum) && (!hasMax || t.amount <= maxNum);
  // 「只看未指定帳戶的」——刪掉帳戶之後那些紀錄會變成不指定帳戶（見刪除帳戶的確認文案），
  // 散在清單裡沒有任何辦法一次撈出來重新歸帳。帳戶被刪掉但 accountId 還留著的孤兒紀錄
  // 也算進來，它們一樣掛不到任何帳戶上。
  const accountIds = new Set(accounts.map((a) => a.id));
  const inAccountFilter = (t: TransactionDTO) => !unassignedOnly || !t.accountId || !accountIds.has(t.accountId);
  const filterCount = (categoryFilters.length > 0 ? 1 : 0) + (hasMin || hasMax ? 1 : 0) + (unassignedOnly ? 1 : 0);
  // 目前生效的條件，一個一個寫成人看得懂的短句。
  //
  // 為什麼需要：條件是在彈窗裡設的，關掉彈窗之後畫面上唯一的線索是日期旁邊那顆篩選
  // 圖示變紫色——看到一份「怎麼只有三筆」的清單時，很難聯想到是自己上次留下來的條件
  // 在作用，更不會記得當初設了什麼。把條件攤在清單正上方，順便給一顆「清除」。
  const filterLabels = [
    categoryFilters.length > 0
      ? categoryFilters.map((id) => categories.find((c) => c.id === id)?.name ?? "某個分類").join("、")
      : null,
    unassignedOnly ? "未指定帳戶" : null,
    hasMin && hasMax ? `${formatCurrency(minNum)}–${formatCurrency(maxNum)}` : hasMin ? `${formatCurrency(minNum)} 以上` : hasMax ? `${formatCurrency(maxNum)} 以下` : null,
  ].filter((l): l is string => l !== null);

  /** 一次清掉所有條件——一個一個回彈窗關很煩，而且容易漏掉其中一個還在作用。 */
  function clearFilters() {
    setCategoryFilters([]);
    setUnassignedOnly(false);
    setMinAmount("");
    setMaxAmount("");
  }

  const rows = (isSearching ? transactions.filter(inKind) : totals[kind === "支出" ? "expenseTx" : "incomeTx"])
    .filter((t) => matchesQuery(t, categories, query))
    .filter(inCategoryFilter)
    .filter(inAmountFilter)
    .filter(inAccountFilter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  // 這一頁刻意不做跟上一期的比較：它是「翻這段期間的每一筆」的地方，合計卡只負責講
  // 這段期間總共多少。期間之間的漲跌要看就去報表頁，比較基準的選擇器也只留在那裡。

  // 多選刪除：可以選的就是「現在畫面上這批」（已經過分頁、搜尋、篩選），全選才不會把
  // 看不到的紀錄也一起選進來——跟收支分類頁同一套（見 selection-bar.tsx）。
  const selection = useSelection(rows.map((t) => t.id));
  // 多選之後的「改帳戶／改分類」整套（兩顆按鈕＋三個彈窗）跟帳戶明細頁共用同一份。
  const bulkEdit = useBulkEdit({
    transactions,
    categories,
    accounts,
    accountTypes,
    transfers,
    selectedIds: selection.selectedIds,
    kind,
    onUpdated: setTransactions,
    onDone: selection.exit,
  });

  // 依日期分組，App 常見的「日期當小標題」條列方式；搜尋時日期標題本身就能告訴使用者是哪個時間。
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }

  function toggleExpanded(id: string) {
    setExpandedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    showToast(TOAST.saved);
    setModal(null);
  }

  async function handleCreate(draft: TransactionModalDraft) {
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    showToast(TOAST.created);
    setAddOpen(false);
  }

  async function handleDelete() {
    if (!modal) return;
    const data: { transactions?: TransactionDTO[]; trashId?: string } = await runBusy("刪除中…", () =>
      fetch(`/api/expenses/transactions?id=${modal.id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({})),
    );
    if (data.transactions) setTransactions(data.transactions);
    // 提示上帶一顆「復原」。錯過了也沒關係，東西在「設定 › 最近刪除」裡。
    showDeleteToast(data.trashId, async () => {
      const latest: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions").then((r) => r.json());
      if (latest.transactions) setTransactions(latest.transactions);
    });
    setModal(null);
  }

  // 逐筆依序 DELETE：API 一次只收一個 id，而且每次都回傳最新的完整清單，照順序打完
  // 最後那一份就是正確的結果（併發送出的話回傳順序不保證，可能拿到中間狀態）。
  async function handleBulkDelete() {
    await runBusy("刪除中…", () => bulkDelete());
  }

  /** 逐筆依序 DELETE——API 一次只收一個 id，而且每次都回傳最新的完整清單。 */
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
    // 多選刪除講清楚刪了幾筆——按下去之前選的是一整批，只說「刪除成功」看不出有沒有漏。
    // 復原會把這一批全部拿回來（見 useUndoDelete）。
    showDeleteToast(
      trashIds,
      async () => {
        const fresh: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions").then((r) => r.json());
        if (fresh.transactions) setTransactions(fresh.transactions);
      },
      `已刪除 ${selection.selectedIds.size} 筆`,
    );
    setDeleteConfirm(null);
    selection.exit();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 標題在左、日期膠囊跟圖示在右，同一列——跟報表頁同一個 PageHeader（那邊是
          「報表」＋日期），兩頁的開頭才是同一種版型。篩選圖示掛在日期那一組的最右邊：
          期間跟篩選條件都是「這份清單要看什麼」，擺一起就不用為了一顆按鈕再多一排。
          有設條件時圖示轉紫（跟分類的名稱一起顯示在彈窗裡），一眼看得出清單是被篩過的。 */}
      <PageHeader
        title="明細"
        flush
        actions={
          <DateFilterPicker
            actions={
              <LineIconButton
                icon="filter"
                active={filterCount > 0}
                onClick={() => setFilterOpen(true)}
                aria-label={filterCount > 0 ? `篩選（${filterCount} 個條件）` : "篩選"}
                title="篩選"
              />
            }
          />
        }
      />

      {/* 這一頁本來只能編輯既有紀錄，要新增得先回首頁——但看著清單想到「啊還有一筆沒記」
          才是最常見的時機。跟首頁同一顆浮動鈕、同一個彈窗。 */}
      <FloatingAddButton onClick={() => setAddOpen(true)} label="新增收支紀錄" />
      {/* AI 記帳疊在＋上面。不想要的話刪這一行＋刪 components/expenses/ai/ 就乾淨了。 */}
      <AiEntryButton
        enabled={aiEnabled}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        onCommitted={setTransactions}
        onCategoriesChange={setCategories}
      />

      {/* key 跟著開關變動＝每次打開都是一個乾淨的彈窗，不會留著上一筆填過的內容。 */}
      <TransactionModal
        key={addOpen ? "add-open" : "add-closed"}
        open={addOpen}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind={kind}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
        onCategoriesChange={setCategories}
      />

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

      {/* 篩選條件有兩種（分類、金額區間），所以點了不會立刻關窗——要讓使用者兩個都設完
          再按「套用」。「全部」是格子裡的第一格，跟其他分類長得一樣（跟新增交易彈窗的
          「＋新增」同一個位置、同一種形狀），不另外佔一整列。 */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="篩選"
        footer={
          <ModalFooter
            onClose={() => setFilterOpen(false)}
            onConfirm={() => setFilterOpen(false)}
            // 清除條件是「把勾選的取消掉」，不是刪資料：走 secondary 而不是 onDelete，
            // 才不會變成紅字、也不會跳「刪掉的東西會進最近刪除」那個二次確認。
            secondary={filterCount > 0 ? { label: "清除條件", onClick: clearFilters } : undefined}
          />
        }
      >
        <div>
          <p className={`mb-2 ${text.label}`}>分類（可複選）</p>
          {/* 跟新增收支紀錄的分類格子同一顆 OptionGrid：選中的那一格是「亮的那一個」，
              沒選中的淡掉，不另外畫外框或色環。本來這裡是手刻的一份，用 ring 當選中
              狀態——同一個工具裡「挑分類」這件事不該有兩種長相。
              「全部」放在第一格（OptionGrid 的 addSlot 位置，跟新增那邊的「＋新增」
              同一個位置），它是「把選擇清空」不是另一個可以被選起來的分類。 */}
          <OptionGrid
            multiple
            options={topLevelCategories(categories, kind).map((c) => ({
              id: c.id,
              name: c.name,
              icon: c.icon,
              colorClass: categoryColorClass[c.color],
            }))}
            values={categoryFilters}
            onToggle={(id) => setCategoryFilters((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
            leadingSlot={{
              icon: "/expenses/income-category-all.png",
              name: "全部",
              active: categoryFilters.length === 0,
              onClick: () => setCategoryFilters([]),
            }}
          />
        </div>

        <div>
          {/* 刪掉帳戶之後，掛在上面的紀錄會變成「不指定帳戶」。沒有這個開關的話，那些
              紀錄就散在清單裡撈不出來，也沒辦法一次改掛到別的帳戶。 */}
          <p className={`mb-2 ${text.label}`}>帳戶</p>
          <button
            type="button"
            onClick={() => setUnassignedOnly((v) => !v)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
              unassignedOnly ? "border-[#6F5FD6] bg-[#F3EFFC] font-medium text-[#6F5FD6]" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
            }`}
          >
            只看未指定帳戶的紀錄
          </button>
        </div>

        <div>
          <p className={`mb-2 ${text.label}`}>金額範圍</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="最小值"
              className={`${fieldInputClass} min-w-0 flex-1`}
            />
            <span className="shrink-0 text-[#C7BFE6]">～</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="最大值"
              className={`${fieldInputClass} min-w-0 flex-1`}
            />
          </div>
        </div>
      </Modal>

      {/* 支出／收入切換跟多選排同一列。篩選本來也在這一列，改成圖示之後搬去日期那一排
          （見上面的 DateFilterPicker actions）。 */}
      <div className="flex items-center gap-2">
        {/* 選中色跟報表頁那組主分頁同一個（實心紫白字，見 theme.ts 的 activeSolid）
            ——兩頁的「支出／收入」是同一件事，不該一邊白底紫字、一邊實心紫。 */}
        <SegmentedControl
          value={kind}
          onChange={setKind}
          activeTone="solid"
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} pendingConfirm={bulkEdit.pending?.onConfirm} />
        </div>
      </div>

      {/* 搜尋列貼著清單：它篩的是下面那份清單，擺在整頁最上面（日期篩選器之上）看起來
          像是跟期間同一組設定。 */}
      <label className="flex items-center gap-2 rounded-full border border-[#ECE4FA] bg-white px-4 py-2.5">
        {/* 跟搭乘車同一套 Font Awesome 實心圖（那邊的鉛筆是 fa-pen），emoji 在不同
            平台長得不一樣、線條粗細也跟整頁的圖示對不上。 */}
        <FaIcon icon="magnifying-glass" size={14} className="shrink-0 text-[#9C94C4]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋備註、分類名稱⋯"
          className="w-full bg-transparent text-sm text-[#4A3B7C] outline-none placeholder:text-[#B3ABD4]"
        />
      </label>

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          // 只有列交易的頁面有批次改資料的動作：分類、帳戶類型那幾頁管的是「定義」，
          // 一批一批改的需求不存在。
          actions={bulkEdit.actions}
          pending={bulkEdit.pending}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={() => setDeleteConfirm([...selection.selectedIds])}
        />
      )}

      {bulkEdit.element}

      <ConfirmModal
        open={deleteConfirm !== null}
        title={`刪除 ${deleteConfirm?.length ?? 0} 筆紀錄`}
        message={`確定要刪除選取的紀錄嗎？${TRASH_RESTORE_NOTE}`}
        confirmLabel="刪除"
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleBulkDelete}
      />

        {/* 搜尋中時不畫這一條：搜尋本身已經有自己的說明列（就在下面），兩條疊在一起
            會把清單推下去，而且講的是同一件事的兩半。 */}
        {!isSearching && filterLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-[#F9F7FE] px-3.5 py-2.5">
            <span className="shrink-0 text-xs font-semibold text-[#6F5FD6]">篩選中</span>
            {/* 條件佔中間、可以換行；筆數跟「清除」釘在右邊——筆數接在條件後面的話會被
                讀成條件的一部分（「未指定帳戶 0 筆」看起來像在篩 0 筆的東西）。 */}
            <span className={`min-w-0 flex-1 ${text.muted}`}>{filterLabels.join("・")}</span>
            <span className={`shrink-0 tabular-nums ${text.muted}`}>{rows.length} 筆</span>
            <button type="button" onClick={clearFilters} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
              清除
            </button>
          </div>
        )}

        {isSearching ? (
          <p className={`px-1 ${text.muted}`}>
            「{query.trim()}」在所有時間的{kind}紀錄中共 {rows.length} 筆符合，不受上方日期篩選影響
          </p>
        ) : (
          rows.length > 0 && (
            <Card>
              <CardBody className="py-3.5">
                <p className={text.muted}>共{kind === "支出" ? "花費" : "收入"}</p>
                <p className={`mt-0.5 ${text.statValue}`}>{formatCurrency(total)}</p>
              </CardBody>
            </Card>
          )
        )}

        {rows.length === 0 ? (
          <Card>
            <CardBody className={`py-10 text-center ${text.muted}`}>
              {/* 有條件在作用時不能寫成「這段期間還沒有支出紀錄」——剛批次改完帳戶的人
                  會以為資料被改不見了，其實只是不符合「只看未指定帳戶」了。 */}
              {isSearching ? "沒有符合的紀錄。" : filterLabels.length > 0 ? "沒有符合篩選條件的紀錄。" : `這段期間還沒有${kind}紀錄。`}
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {[...groups.entries()].map(([date, items]) => (
              <div key={date}>
                {/* 日期右邊掛當天的小計——只有「這段期間總共花多少」的話，要知道某一天花了
                    多少還得自己把那幾列加起來。金額的正負號跟下面每一列一致。 */}
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                  <p className={`font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
                  {/* 跟左邊的日期同一個字級字色——當天小計是這一組的標頭資訊，不是要跟
                      下面每一列的金額搶眼睛。 */}
                  <p className={`font-medium tabular-nums ${text.muted}`}>
                    {kind === "收入" ? "＋" : "－"}
                    {formatCurrency(items.reduce((sum, t) => sum + t.amount, 0))}
                  </p>
                </div>
                <ListCard>
                  {items.map((t) => {
                    const category = categoryById(categories, t.categoryId);
                    const breakdown = t.breakdown ?? [];
                    const expanded = expandedIds.has(t.id);
                    return (
                      <div key={t.id}>
                        {/* 選取模式時整一列就是一個勾選目標：圓點、圖示、名稱、金額全部
                            包在同一顆按鈕裡（圓點只是指示器，見 SelectionDot）。本來圓點
                            掛在按鈕外面，點它完全沒反應——而它看起來最像 checkbox，所以
                            大家第一下都點那裡。role/aria-checked 也一起補上，不然螢幕
                            報讀器讀不出這一列有沒有被選。 */}
                        <div className="flex w-full items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            role={selection.selecting ? "checkbox" : undefined}
                            aria-checked={selection.selecting ? selection.selectedIds.has(t.id) : undefined}
                            onClick={() => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            {selection.selecting && <SelectionDot selected={selection.selectedIds.has(t.id)} />}
                            <TransactionRowLabel
                              icon={category?.icon ?? ""}
                              iconClassName={category ? categoryColorClass[category.color] : undefined}
                              title={transactionDisplayName(t, categories)}
                              subtitle={categoryPath(categories, t.categoryId)}
                            />
                            {/* 只有金額，不再掛「記完之後帳戶剩多少」那行小字：那是
                                帳戶的餘額，要看哪個戶頭剩多少去資產總表，列在每一筆
                                消費旁邊只是讓每一列都多一行雜訊。 */}
                            <span className={`shrink-0 tabular-nums font-semibold text-[#4A3B7C] ${kind === "收入" ? "text-[#2FAE82]" : ""}`}>
                              {kind === "收入" ? "＋" : "－"}
                              {formatCurrency(t.amount)}
                            </span>
                          </button>
                          {/* 選取模式時不顯示展開箭頭：正在挑要刪哪幾筆的時候不會想
                              展開看拆帳明細，而留著它等於在整列的勾選範圍右邊挖一個
                              點不到的洞。 */}
                          {!selection.selecting && breakdown.length > 0 && (
                            <BreakdownToggle expanded={expanded} onClick={() => toggleExpanded(t.id)} />
                          )}
                        </div>
                        {!selection.selecting && expanded && breakdown.length > 0 && <TransactionBreakdown items={breakdown} />}
                      </div>
                    );
                  })}
                </ListCard>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
