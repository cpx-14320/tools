"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { ListCard } from "@/components/expenses/list-row";
import { Carousel } from "@/components/expenses/carousel";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text } from "@/components/expenses/theme";
import { compareDateFilter, dateFilterRange, defaultDateFilter, referenceYearMonth } from "@/lib/expenses/date-filter";
import { ComparePicker } from "@/components/expenses/compare-picker";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { categoryColorClass, categoryFillClass, displayCategoryOf, type CategoryDTO } from "@/lib/expenses/categories";
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

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = 5;

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
  const breakdown = categoryBreakdown(expenseTx, categories);
  const incomeRows = incomeBreakdown(incomeTx, categories);
  const recent = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

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
        value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
        valueColor={balance >= 0 ? "#4A3B7C" : KPI_NEGATIVE}
        delta={balanceDelta && <DeltaText delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp />}
      />
      <Carousel
        perSlide={2}
        slides={[
          <KpiCard
            key="income"
            label="本月收入"
            value={formatCurrency(totalIncome)}
            valueColor="#4A3B7C"
            delta={incomeDelta && <DeltaText delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp />}
          />,
          <KpiCard
            key="expense"
            label="本月支出"
            value={formatCurrency(totalExpense)}
            valueColor="#4A3B7C"
            delta={expenseDelta && <DeltaText delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} />}
          />,
          <KpiCard key="recurring" label="固定收支" value={formatCurrency(recurringThisMonthTotal)} valueColor="#4A3B7C" />,
          // 淨資產用的是資產總表同一個算式，而且首頁本來就已經抓了帳戶／類型／轉帳
          // （新增交易彈窗要用），所以多這張卡不用多打任何一支 API。
          <KpiCard
            key="networth"
            label="淨資產"
            value={`${net >= 0 ? "" : "－"}${formatCurrency(Math.abs(net))}`}
            valueColor={net < 0 ? KPI_NEGATIVE : "#4A3B7C"}
          />,
        ]}
      />

      {/* 小標在白框外面、清單在框裡——跟資產總表的「資產」區塊同一種結構。 */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>{isCurrentMonth ? "本月預算" : `${budgetYearMonth} 預算`}</p>
          <Link href={`/tools/expenses/transactions?${budgetDetailQuery}`} className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {budget.rows.length === 0 ? (
          <p className={`px-1 ${text.muted}`}>還沒有分類編預算，到「設定 › 預算設定」可以按月份設定。</p>
        ) : (
          <ListCard>
            <div className="px-4 py-3.5">
              <div className="flex items-end justify-between gap-2">
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
            {/* 每一列都可以點，直接跳到紀錄頁、而且已經幫你篩好那個分類的明細。 */}
            {budget.rows.slice(0, SUMMARY_LIMIT).map((row) => (
              <Link
                key={row.category.id}
                href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <ListProgressRow
                  icon={row.category.icon}
                  iconClassName={categoryColorClass[row.category.color]}
                  name={row.category.name}
                  amount={`${formatCurrency(row.spent)} / ${formatCurrency(row.budgetAmount)}`}
                  pct={row.pct}
                  pctLabel={<span className={row.pct > 100 ? "text-[#D1517E]" : undefined}>{row.pct}%</span>}
                  barColorClass={row.pct > 100 ? "bg-[#D1517E]" : categoryFillClass[row.category.color]}
                />
              </Link>
            ))}
          </ListCard>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>消費分類佔比</p>
          <Link href="/tools/expenses/transactions?kind=支出" className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {breakdown.length === 0 ? (
          <p className={`px-1 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
        ) : (
          // 點某一類（例如「居家」）直接跳到紀錄頁、而且已經篩好只剩那一類的明細。
          <ListCard>
            {breakdown.slice(0, SUMMARY_LIMIT).map((row) => (
              <Link
                key={row.category.id}
                href={`/tools/expenses/transactions?kind=支出&categoryId=${row.category.id}`}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <ListProgressRow
                  icon={row.category.icon}
                  iconClassName={categoryColorClass[row.category.color]}
                  name={row.category.name}
                  amount={formatCurrency(row.amount)}
                  pct={row.pct}
                  barColorClass={categoryFillClass[row.category.color]}
                />
              </Link>
            ))}
          </ListCard>
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
        {recent.length === 0 ? (
          <p className={`px-1 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
        ) : (
          // 跟「查看全部」進去的明細列同一種長相（左圖右文），差別只在首頁這裡每一列
          // 自己帶日期，不照日期分組——首頁只有五筆，為了五筆拆成好幾個日期區塊反而更零碎。
          <ListCard>
            {recent.map((t) => {
              // 子分類沿用大分類的圖示與顏色：「下午茶」顯示的是「餐飲」那顆。
              const cat = displayCategoryOf(categories, t.categoryId);
              return (
                // 整列都可以點，跟右上角的「查看全部」去同一頁——列出來的東西看起來就像
                // 可以點進去看細節，點了沒反應只會讓人以為壞掉。
                <Link key={t.id} href="/tools/expenses/transactions" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <TransactionRowLabel
                    icon={cat?.icon ?? "🏷️"}
                    iconClassName={cat ? categoryColorClass[cat.color] : undefined}
                    title={transactionDisplayName(t, categories)}
                    subtitle={t.date}
                  />
                  <span className="shrink-0 tabular-nums font-medium text-[#4A3B7C]">－{formatCurrency(t.amount)}</span>
                </Link>
              );
            })}
          </ListCard>
        )}
      </div>
    </div>
  );
}
