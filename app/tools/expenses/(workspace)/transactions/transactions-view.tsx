"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SegmentedControl, PillButton } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { ComparePicker } from "@/components/expenses/compare-picker";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { BreakdownToggle, TransactionBreakdown } from "@/components/expenses/transaction-breakdown";
import { compareDateFilter, compareLabel, dateFilterRange, defaultDateFilter } from "@/lib/expenses/date-filter";
import { isValidYearMonth } from "@/lib/expenses/budgets";
import { Modal } from "@/components/expenses/modal";
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
  transactionsInDateRange,
  totalsForRange,
  rangeDelta,
  transactionDisplayName,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
import { transactionBalancesByAccount, type AccountDTO } from "@/lib/expenses/accounts";
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
  const { filter, setFilter, compare } = useDateFilter();
  // 首頁那幾個區塊的「查看全部」會帶 ?kind=收入 過來、點某一類的列會再多帶
  // &categoryId=xxx，直接幫使用者切到對的分頁並且篩好分類，不用進來之後再點一次。
  const searchParams = useSearchParams();
  const initialKind: CategoryKind = searchParams.get("kind") === "收入" ? "收入" : "支出";
  const initialCategoryId = searchParams.get("categoryId") ?? "";
  // 預算卡片是以月為單位的，點進來時會帶 &month=YYYY-MM，把共用的日期篩選器切到同一個月，
  // 不然首頁顯示的是 10 月預算、進來卻還停在篩選器上次留著的區間，兩邊數字對不起來。
  const requestedMonth = searchParams.get("month") ?? "";
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  // 只看某一個大分類（含它的子分類）的篩選，空字串＝全部分類。
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId);
  const [filterOpen, setFilterOpen] = useState(false);
  // 哪幾筆的明細是展開的——預設全部收起來，只有有明細的那幾筆才看得到展開箭頭。
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 這頁現在只處理既有紀錄的編輯（新增交易改到首頁的浮動按鈕），所以只需要存「正在編輯
  // 哪一筆」，不用再分 create/edit 兩種模式。
  const [modal, setModal] = useState<TransactionDTO | null>(null);
  const isSearching = query.trim().length > 0;
  const range = dateFilterRange(filter);

  // 只在掛載時套用一次網址帶來的月份；之後使用者自己在篩選器上改的就不要再被蓋回去。
  useEffect(() => {
    if (!isValidYearMonth(requestedMonth)) return;
    const [y, m] = requestedMonth.split("-").map(Number);
    setFilter({ ...defaultDateFilter(), mode: "month", year: y, month: m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // 每筆交易「記完之後」掛的那個帳戶變成多少——跟分頁/篩選無關，一律用全部資料算，
  // 不然切換篩選器看到的「交易後餘額」會跟著篩選範圍錯亂。
  const accountBalances = transactionBalancesByAccount(accounts, accountTypes, transactions, categories, transfers);

  // 分類篩選比對的是「頂層分類」，所以選「餐飲」時連它底下的子分類（早餐…）也會留下來。
  const inCategoryFilter = (t: TransactionDTO) => !categoryFilter || topLevelCategoryId(categories, t.categoryId) === categoryFilter;
  const filterCategory = categoryFilter ? categoryById(categories, categoryFilter) : undefined;

  const rows = (isSearching ? transactions.filter(inKind) : totals[kind === "支出" ? "expenseTx" : "incomeTx"])
    .filter((t) => matchesQuery(t, categories, query))
    .filter(inCategoryFilter)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  // 「跟誰比」由使用者選的比較基準決定，徽章後綴也跟著換（vs 上期／vs 去年同期…）。
  const baseline = compareDateFilter(filter, compare);
  const deltaSuffix = compareLabel(filter, compare);
  const delta = rangeDelta(
    (r) => totalsForRange(transactions, categories, r)[kind === "支出" ? "totalExpense" : "totalIncome"],
    filter,
    (r) => transactionsInDateRange(transactions, r).length > 0,
    baseline,
  );

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

      {/* 「全部」就是格子裡的第一格，跟其他分類長得一樣（跟新增交易彈窗的「＋新增」
          同一個位置、同一種形狀），不另外佔一整列。 */}
      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="篩選分類">
        <div className="grid grid-cols-5 gap-x-1 gap-y-2.5">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("");
              setFilterOpen(false);
            }}
            className="flex flex-col items-center gap-1 py-0.5"
          >
            <IconAvatar
              icon="全"
              size="sm"
              className={`bg-[#F3EFFC] text-[#6F5FD6] ${!categoryFilter ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
            />
            <span className={`line-clamp-1 w-full text-center text-[11px] ${!categoryFilter ? "font-semibold text-[#6F5FD6]" : "font-medium text-[#4A3B7C]"}`}>
              全部
            </span>
          </button>
          {topLevelCategories(categories, kind).map((c) => {
            const active = c.id === categoryFilter;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategoryFilter(c.id);
                  setFilterOpen(false);
                }}
                className="flex flex-col items-center gap-1 py-0.5"
              >
                <IconAvatar icon={c.icon} size="sm" className={`${categoryColorClass[c.color]} ${active ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`} />
                <span className={`line-clamp-1 w-full text-center text-[11px] ${active ? "font-semibold text-[#6F5FD6]" : "font-medium text-[#4A3B7C]"}`}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* 支出／收入切換、分類篩選、比較基準排同一列——三個都是「這份清單要看什麼」的
          開關，拆成兩三列反而要找。PillButton 跟 SegmentedControl 等高，並排不會一高一低。 */}
      <div className="mb-4 flex items-center gap-2">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {/* 分類篩選：有選的時候按鈕變實心＋顯示分類名稱，一眼看得出清單是被篩過的。 */}
          <PillButton onClick={() => setFilterOpen(true)} active={!!filterCategory}>
            <span aria-hidden>⌕</span>
            <span className="max-w-[64px] truncate">{filterCategory ? filterCategory.name : "篩選"}</span>
          </PillButton>
          <ComparePicker />
        </div>
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
                      const breakdown = t.breakdown ?? [];
                      const expanded = expandedIds.has(t.id);
                      // 有掛帳戶才顯示「記完之後帳戶變成多少」——沒指定帳戶的紀錄沒有
                      // 「資產」可以講，帳戶被刪除（accounts 裡找不到）也不顯示，不然
                      // 會冒出一個查無名稱的帳戶。
                      const account = t.accountId ? accounts.find((a) => a.id === t.accountId) : undefined;
                      const balanceAfter = account ? accountBalances.get(`tx:${t.id}`) : undefined;
                      return (
                        <div key={t.id}>
                          <div className="flex w-full items-center gap-1 px-4 py-3">
                            <button type="button" onClick={() => setModal(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                              <IconAvatar
                                icon={category?.icon ?? ""}
                                size="sm"
                                className={category ? categoryColorClass[category.color] : undefined}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[#4A3B7C]">{transactionDisplayName(t, categories)}</p>
                                <p className={`truncate ${text.muted}`}>{categoryPath(categories, t.categoryId)}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end">
                                <span className={`tabular-nums font-semibold text-[#4A3B7C] ${kind === "收入" ? "text-[#2FAE82]" : ""}`}>
                                  {kind === "收入" ? "＋" : "－"}
                                  {formatCurrency(t.amount)}
                                </span>
                                {account && balanceAfter !== undefined && (
                                  <span className={`mt-0.5 max-w-[120px] truncate tabular-nums ${text.faint}`}>
                                    {account.name} {formatCurrency(balanceAfter)}
                                  </span>
                                )}
                              </div>
                            </button>
                            {breakdown.length > 0 && <BreakdownToggle expanded={expanded} onClick={() => toggleExpanded(t.id)} />}
                          </div>
                          {expanded && breakdown.length > 0 && <TransactionBreakdown items={breakdown} />}
                        </div>
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
