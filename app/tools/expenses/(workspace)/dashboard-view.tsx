"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { Carousel } from "@/components/expenses/carousel";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { HiddenAmountsToggle, useHiddenAmounts } from "@/components/expenses/hidden-amounts";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text } from "@/components/expenses/theme";
import { compareDateFilter, dateFilterRange, defaultDateFilter, referenceYearMonth } from "@/lib/expenses/date-filter";
import { ComparePicker } from "@/components/expenses/compare-picker";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { categoryColorClass, categoryFillClass, categoryPath, displayCategoryOf, topLevelCategories, type CategoryDTO } from "@/lib/expenses/categories";
import {
  totalsForRange,
  rangeDelta,
  categoryBreakdown,
  incomeBreakdown,
  budgetSummary,
  transactionsInDateRange,
  transactionDisplayName,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
import { netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { budgetPace, monthDaysLeft, withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import { formatCurrency } from "@/lib/format";

/** 把 `YYYY-MM-DD` 往前／往後推幾天。用本地時區的 Date 做日曆運算，不碰 UTC。 */
/** 依日期分組的清單，跨組往下數到第 limit 筆為止（數滿了的那一組只留前面幾筆，
 *  後面的組整組捨去）。給「最近消費」收合用。 */
function limitEntries<T>(groups: [string, T[]][], limit: number): [string, T[]][] {
  const out: [string, T[]][] = [];
  let left = limit;
  for (const [date, items] of groups) {
    if (left <= 0) break;
    out.push([date, items.slice(0, left)]);
    left -= items.length;
  }
  return out;
}

function shiftDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + delta);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = PREVIEW_COUNT;

export function DashboardView() {
  const { filter, compare } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 兩張長清單各自的「展開／收合」，預設都是收起來的（見 ExpandToggle）。
  const [expenseRowsExpanded, setExpenseRowsExpanded] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  // 在外面看記帳本時把金額遮起來，記在這台裝置上（見 hidden-amounts.tsx）。
  const { hidden: amountsHidden, toggle: toggleAmounts, mask } = useHiddenAmounts();
  // 「今天」掛載時算一次固定住——render 當中讀時鐘是不純的。
  const [todayISO] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
      fetch("/api/expenses/budgets").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, accountsData, accountTypesData, transfersData, budgetsData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { transfers?: TransferDTO[] },
          { rules?: BudgetRuleDTO[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setTransfers(transfersData.transfers ?? []);
          setBudgetRules(budgetsData.rules ?? []);
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

  async function handleCreateTransaction(draft: TransactionModalDraft) {
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    setAddOpen(false);
  }

  const range = dateFilterRange(filter);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(transactions, r).length > 0;

  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(transactions, categories, range);
  // 「跟誰比」由使用者在比較基準選單決定（上一期／去年同期／指定年份同期／不比較）。
  const baseline = compareDateFilter(filter, compare);
  const incomeDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalIncome, filter, hasPriorData, baseline);
  const expenseDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalExpense, filter, hasPriorData, baseline);
  const balanceDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).balance, filter, hasPriorData, baseline);
  const incomeRows = incomeBreakdown(incomeTx, categories);
  // 「最近消費」只看近 7 天，而且是以「這段期間裡最新的一筆」為基準往回推——用今天當
  // 基準的話，翻到過去的月份時這一區會整個空掉。依日期分組（新的在上面），跟消費紀錄
  // 頁同一種版面。
  const sortedExpenses = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentCutoff = sortedExpenses.length > 0 ? shiftDays(sortedExpenses[0].date, -6) : "";
  const recentGroups = [...
    sortedExpenses
      .filter((t) => t.date >= recentCutoff)
      .reduce((map, t) => map.set(t.date, [...(map.get(t.date) ?? []), t]), new Map<string, TransactionDTO[]>())
  ];
  const recentCount = recentGroups.reduce((sum, [, items]) => sum + items.length, 0);
  // 每一天的小計一律照「那一天全部的紀錄」算，不是照收合後看得到的那幾筆——被收起來的
  // 那天如果只剩兩筆，小計卻跟著縮水的話，展開前後同一天會出現兩個不同的金額。
  const recentDayTotals = new Map(recentGroups.map(([date, items]) => [date, items.reduce((sum, t) => sum + t.amount, 0)]));
  // 收起來時算的是「總共幾筆」，不是「幾天」——同一天可能有五六筆，照天數切的話收合後
  // 還是一長串。所以跨日期往下數到第 PREVIEW_COUNT 筆為止，那一天剩下的就一起收起來。
  const visibleRecentGroups = recentExpanded ? recentGroups : limitEntries(recentGroups, PREVIEW_COUNT);

  // 預算本來就是以「月」為單位，所以不直接吃篩選器的區間（可能是一天、一年或自訂區間），
  // 而是取篩選器的參考月份：篩到 2026-08 就看 8 月的預算，切回本月就看本月。這樣卡片標題、
  // 卡片數字、跟點「查看全部」進去看到的明細講的都是同一個月，不會首頁說本月、點進去卻是
  // 篩選器停留的另一個月。
  const budgetYearMonth = referenceYearMonth(filter);
  const [budgetYear, budgetMonth] = budgetYearMonth.split("-").map(Number);
  const budgetMonthRange = dateFilterRange({ ...filter, mode: "month", year: budgetYear, month: budgetMonth });
  const budgetMonthExpenseTx = totalsForRange(transactions, categories, budgetMonthRange).expenseTx;
  const budget = budgetSummary(budgetMonthExpenseTx, categories, withLegacyCategoryBudgets(budgetRules, categories), budgetYearMonth);
  const isCurrentMonth = budgetYearMonth === referenceYearMonth(defaultDateFilter());
  const budgetTotalPace = budgetPace(budget.totalSpent, budget.totalBudget, budgetYearMonth, todayISO);
  const budgetDaysLeft = monthDaysLeft(budgetYearMonth, todayISO);

  // 首頁的支出清單把「有編預算」跟「沒編預算」的分類列在一起（跟預算設定頁同一種列法），
  // 所以不需要再另外放一個「消費分類佔比」區塊——那塊列的分類這裡全都有，而且還多了
  // 預算狀態。沒編預算的分類只顯示花了多少，不畫進度條（沒有分母可以畫）。
  const budgetedById = new Map(budget.rows.map((r) => [r.category.id, r]));
  const spentById = new Map(categoryBreakdown(budgetMonthExpenseTx, categories).map((r) => [r.category.id, r.amount]));
  const expenseRows = topLevelCategories(categories, "支出")
    .map((category) => ({ category, spent: spentById.get(category.id) ?? 0, budget: budgetedById.get(category.id) ?? null }))
    .filter((row) => row.spent > 0 || row.budget !== null)
    .sort((a, b) => b.spent - a.spent);

  // 固定收支本月已經自動入帳的金額——有 sourceRuleId 就代表這筆是規則產生的。只看交易
  // 紀錄就算得出來，不用再去拉一次規則清單。
  const recurringThisMonthTotal = transactions
    .filter((t) => t.sourceRuleId && t.date.slice(0, 7) === referenceYearMonth(defaultDateFilter()))
    .reduce((sum, t) => sum + t.amount, 0);
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  // 帶上月份，點進去的紀錄頁會把共用篩選器切到同一個月，數字才對得起來。
  const budgetDetailQuery = `kind=支出&month=${budgetYearMonth}`;

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <DateFilterPicker compact />
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DateFilterPicker compact />
      <div className="-mt-1 flex justify-end">
        <ComparePicker />
      </div>

      {/* key 跟著開關變動＝每次打開都重新掛載一個乾淨的彈窗：不這樣做的話，上一筆填過的
          金額、分類會原封不動留著，使用者得自己一個一個清掉才能記下一筆。其他頁面的
          編輯彈窗本來就是用 key 帶 id 達到同樣效果，這裡補齊。 */}
      <TransactionModal
        key={addOpen ? "add-open" : "add-closed"}
        open={addOpen}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind="支出"
        onClose={() => setAddOpen(false)}
        onSave={handleCreateTransaction}
        onCategoriesChange={setCategories}
      />

      {/* 新增交易的入口搬到首頁，固定在卡片右下角（底部導覽列上方）——跟搭乘車同一招，
          fixed 子孫以外殼卡片容器（有 transform）為定位基準，不是整個瀏覽器視窗。用純
          「＋」而不是其他 emoji，跟選單圖示區分開，一眼就看得出是「新增」的動作。 */}
      <FloatingAddButton onClick={() => setAddOpen(true)} label="新增交易" />

      {/* 整寬的那張放「結餘」不是「收入」：收入一個月大概就那幾筆、不太會變，結餘才是
          每記一筆都會動、而且直接回答「我這個月還能花多少」的那個數字，值得最大的版面。
          收入退回輪播裡跟支出、固定收支、淨資產並列，剛好四張＝兩頁兩欄，不會留半格空白。 */}
      <KpiCard
        label="本月結餘"
        value={mask(`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`)}
        valueColor={balance >= 0 ? "#4A3B7C" : KPI_NEGATIVE}
        delta={balanceDelta && <DeltaText delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp />}
        // 眼睛只掛在這張最上面的卡上，但管的是下面整排（收入／支出／固定收支／淨資產）。
        action={<HiddenAmountsToggle hidden={amountsHidden} onToggle={toggleAmounts} />}
      />
      <Carousel
        perSlide={2}
        slides={[
          <KpiCard
            key="income"
            label="本月收入"
            value={mask(formatCurrency(totalIncome))}
            valueColor="#4A3B7C"
            delta={incomeDelta && <DeltaText delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp />}
          />,
          <KpiCard
            key="expense"
            label="本月支出"
            value={mask(formatCurrency(totalExpense))}
            valueColor="#4A3B7C"
            delta={expenseDelta && <DeltaText delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} />}
          />,
          <KpiCard key="recurring" label="固定收支" value={mask(formatCurrency(recurringThisMonthTotal))} valueColor="#4A3B7C" />,
          // 淨資產用的是資產總表同一個算式，而且首頁本來就已經抓了帳戶／類型／轉帳
          // （新增交易彈窗要用），所以多這張卡不用多打任何一支 API。
          <KpiCard
            key="networth"
            label="淨資產"
            value={mask(`${net >= 0 ? "" : "－"}${formatCurrency(Math.abs(net))}`)}
            valueColor={net < 0 ? KPI_NEGATIVE : "#4A3B7C"}
          />,
        ]}
      />

      {/* 小標在白框外面、清單在框裡——跟資產總表的「資產」區塊同一種結構。 */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>{isCurrentMonth ? "本月預算支出" : `${budgetYearMonth} 預算支出`}</p>
          <Link href={`/tools/expenses/transactions?${budgetDetailQuery}`} className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {expenseRows.length === 0 ? (
          <p className={`px-1 ${text.muted}`}>這個月還沒有支出紀錄。</p>
        ) : (
          <ListCard>
            <div className="px-4 py-3.5">
              {/* items-center：金額、剩餘天數、百分比三個字級不一樣（lg／11px／xs），
                  靠底部對齊的話小字會沉下去，看起來沒對齊。 */}
              <div className="flex items-center justify-between gap-2">
                <p className={text.statValue}>
                  {formatCurrency(budget.totalSpent)}
                  <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(budget.totalBudget)}</span>
                </p>
                {/* 超支與否用小標籤講清楚，旁邊再附「這個月還剩幾天」——只看百分比的話，
                    不知道是「才過幾天就用掉八成」還是「月底了剛好用到八成」。 */}
                <span className="flex shrink-0 items-center gap-1.5">
                  {budget.totalSpent > budget.totalBudget && (
                    <span className="rounded-full bg-[#FDEEF0] px-2 py-0.5 text-[11px] font-semibold text-[#D1517E]">已超支</span>
                  )}
                  {budgetDaysLeft > 0 && (
                    <span className="rounded-full bg-[#F3EFFC] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[#6F5FD6]">
                      剩 {budgetDaysLeft} 天
                    </span>
                  )}
                  <span className={`text-xs font-semibold ${budget.pct > 100 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{budget.pct}%</span>
                </span>
              </div>
              {/* 還沒超支、但照目前的速度月底會超支時才提醒（見 lib/expenses/budgets.ts）。 */}
              {budgetTotalPace && (
                <p className="mt-1 text-xs text-[#D1517E]">
                  照這個速度，月底大約會花到 {formatCurrency(budgetTotalPace.projected)}（超出 {formatCurrency(budgetTotalPace.projectedOver)}）・還剩{" "}
                  {budgetTotalPace.daysLeft} 天
                </p>
              )}
            </div>
            {/* 每一列都可以點，直接跳到紀錄頁、而且已經幫你篩好那個分類的明細。
                有編預算的畫「花了多少／預算多少」的進度條，沒編預算的只報金額——沒有
                分母就沒有進度可言，硬畫一條空的反而像是用了 0%。 */}
            {(expenseRowsExpanded ? expenseRows : expenseRows.slice(0, SUMMARY_LIMIT)).map((row) =>
              row.budget ? (
                <Link
                  key={row.category.id}
                  href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <ListProgressRow
                    icon={row.category.icon}
                    iconClassName={categoryColorClass[row.category.color]}
                    name={row.category.name}
                    amount={`${formatCurrency(row.budget.spent)} / ${formatCurrency(row.budget.budgetAmount)}`}
                    pct={row.budget.pct}
                    pctLabel={<span className={row.budget.pct > 100 ? "text-[#D1517E]" : undefined}>{row.budget.pct}%</span>}
                    barColorClass={row.budget.pct > 100 ? "bg-[#D1517E]" : categoryFillClass[row.category.color]}
                  />
                </Link>
              ) : (
                <ListRow
                  key={row.category.id}
                  href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                  icon={row.category.icon}
                  iconClassName={categoryColorClass[row.category.color]}
                  name={row.category.name}
                  right={
                    <span className="text-sm">
                      <span className="tabular-nums font-semibold text-[#4A3B7C]">{formatCurrency(row.spent)}</span>
                      <span className={`ml-1.5 ${text.muted}`}>未編預算</span>
                    </span>
                  }
                />
              ),
            )}
          </ListCard>
        )}
        {expenseRows.length > SUMMARY_LIMIT && (
          <ExpandToggle
            expanded={expenseRowsExpanded}
            total={expenseRows.length}
            onToggle={() => setExpenseRowsExpanded((v) => !v)}
          />
        )}
      </div>

      {incomeRows.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className={text.sectionHeading}>收入來源</p>
            {/* 導去紀錄頁的「收入」分頁看每一天的細項（薪資那種有明細的還可以展開看
                本薪/勞健保），不是跳到只有彙總圖表的報表頁。 */}
            <Link href="/tools/expenses/transactions?kind=收入" className="text-xs font-medium text-[#6F5FD6]">
              查看全部
            </Link>
          </div>
          <ListCard>
            {incomeRows.slice(0, SUMMARY_LIMIT).map((row) => (
              <Link
                key={row.id}
                href={`/tools/expenses/transactions?kind=收入&categoryId=${row.id}`}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <ListProgressRow
                  icon={row.icon}
                  iconClassName="bg-[#E3F6EC] text-[#2FAE82]"
                  name={row.name}
                  amount={formatCurrency(row.amount)}
                  pct={row.pct}
                  barColorClass="bg-[#2FAE82]"
                />
              </Link>
            ))}
          </ListCard>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>最近消費</p>
          <Link href="/tools/expenses/transactions" className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {recentGroups.length === 0 ? (
          <p className={`px-1 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
        ) : (
          // 版面跟「查看全部」進去的消費紀錄頁一樣：日期當小標、右邊掛當天小計，底下才是
          // 那一天的明細（標題是備註/分類、副標是分類路徑）。
          <div className="flex flex-col gap-4">
            {visibleRecentGroups.map(([date, items]) => (
              <div key={date}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                  <p className={`font-medium ${text.muted}`}>{date}</p>
                  <p className={`font-medium tabular-nums ${text.muted}`}>－{formatCurrency(recentDayTotals.get(date) ?? 0)}</p>
                </div>
                <ListCard>
                  {items.map((t) => {
                    // 子分類沿用大分類的圖示與顏色：「下午茶」顯示的是「餐飲」那顆。
                    const cat = displayCategoryOf(categories, t.categoryId);
                    return (
                      // 整列都可以點，跟右上角的「查看全部」去同一頁。
                      <Link key={t.id} href="/tools/expenses/transactions" className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <TransactionRowLabel
                          icon={cat?.icon ?? "🏷️"}
                          iconClassName={cat ? categoryColorClass[cat.color] : undefined}
                          title={transactionDisplayName(t, categories)}
                          subtitle={categoryPath(categories, t.categoryId)}
                        />
                        <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">－{formatCurrency(t.amount)}</span>
                      </Link>
                    );
                  })}
                </ListCard>
              </div>
            ))}
            {recentCount > PREVIEW_COUNT && (
              <ExpandToggle
                expanded={recentExpanded}
                total={recentCount}
                onToggle={() => setRecentExpanded((v) => !v)}
                label="顯示近七日"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
