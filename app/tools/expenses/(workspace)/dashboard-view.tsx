"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { Card, CardBody } from "@/components/expenses/card";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text } from "@/components/expenses/theme";
import { compareDateFilter, dateFilterRange, defaultDateFilter, referenceYearMonth } from "@/lib/expenses/date-filter";
import { ComparePicker } from "@/components/expenses/compare-picker";
import { IconAvatar } from "@/components/expenses/icon-avatar";
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
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import { upcomingOccurrences, type RecurringRuleDTO } from "@/lib/expenses/recurring-rules";
import { formatCurrency } from "@/lib/format";

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = 5;

/** 「接下來會自動入帳」往前看幾天——兩週剛好涵蓋一般的月繳、雙週繳週期，又不會把
 *  下個月的東西全部拉進首頁。 */
const UPCOMING_DAYS = 14;

/** 本地日期字串（不是 UTC）——toISOString() 在台灣時區的凌晨會回到前一天。 */
function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DashboardView() {
  const { filter, compare } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleDTO[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 「今天」在元件掛載時算一次就固定住——讀時鐘是不純的，在 render 當中呼叫會讓同一次
  // 繪製的前後拿到不一樣的值（跨午夜時甚至會不一致）。
  const [[todayISO, upcomingUntil]] = useState(() => {
    const now = new Date();
    return [toLocalISO(now), toLocalISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + UPCOMING_DAYS))];
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
      fetch("/api/expenses/recurring-rules").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, accountsData, accountTypesData, transfersData, budgetsData, recurringData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { transfers?: TransferDTO[] },
          { rules?: BudgetRuleDTO[] },
          { rules?: RecurringRuleDTO[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(accountTypesData.accountTypes ?? []);
          setTransfers(transfersData.transfers ?? []);
          setBudgetRules(budgetsData.rules ?? []);
          setRecurringRules(recurringData.rules ?? []);
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

  // 固定收支：本月已經自動入帳的那幾筆（有 sourceRuleId 就代表是規則產生的），以及
  // 接下來 UPCOMING_DAYS 天內還會自動入帳的幾期。
  const recurringThisMonth = transactions.filter((t) => t.sourceRuleId && t.date.slice(0, 7) === referenceYearMonth(defaultDateFilter()));
  const recurringThisMonthTotal = recurringThisMonth.reduce((sum, t) => sum + t.amount, 0);
  const upcoming = upcomingOccurrences(recurringRules, todayISO, upcomingUntil);
  // 帶上月份，點進去的紀錄頁會把共用篩選器切到同一個月，數字才對得起來。
  const budgetDetailQuery = `kind=支出&month=${budgetYearMonth}`;

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <DateFilterPicker />
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DateFilterPicker />
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

      {/* 收入獨立一整排、支出跟結餘並排各半——收入是看整體財務狀況時最先想看的數字，
          拉成滿版比較醒目；支出跟結餘互相比較的意義比較大（花了多少、剩多少），並排
          方便一眼對照。薪資不再是獨立算出來的特例，就是收入分類加總的其中一塊，想看
          薪資自己漲跌多少，看「收入來源」卡片裡薪資那一列即可，不需要 Dashboard 再
          另外開一組指標。 */}
      <KpiCard
        label="本月收入"
        value={formatCurrency(totalIncome)}
        valueColor="#4A3B7C"
        delta={incomeDelta && <DeltaText delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp />}
      />
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="本月支出"
          value={formatCurrency(totalExpense)}
          valueColor="#4A3B7C"
          delta={expenseDelta && <DeltaText delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} />}
        />
        <KpiCard
          label="本月結餘"
          value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
          valueColor={balance >= 0 ? "#4A3B7C" : KPI_NEGATIVE}
          delta={balanceDelta && <DeltaText delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp />}
        />
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <p className={text.sectionHeading}>{isCurrentMonth ? "本月預算" : `${budgetYearMonth} 預算`}</p>
            <Link href={`/tools/expenses/transactions?${budgetDetailQuery}`} className="text-xs font-medium text-[#6F5FD6]">
              查看全部
            </Link>
          </div>
          {budget.rows.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>還沒有分類編預算，到「設定 › 預算設定」可以按月份設定。</p>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className={text.statValue}>
                  {formatCurrency(budget.totalSpent)}
                  <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(budget.totalBudget)}</span>
                </p>
                <span className={`text-xs font-semibold ${budget.pct > 100 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{budget.pct}%</span>
              </div>
              {/* 每一列都可以點，直接跳到紀錄頁、而且已經幫你篩好那個分類的明細。 */}
              <div className="mt-4 flex flex-col gap-3">
                {budget.rows.slice(0, SUMMARY_LIMIT).map((row) => (
                  <Link
                    key={row.category.id}
                    href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                    className="flex items-center gap-3"
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
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <p className={text.sectionHeading}>消費分類佔比</p>
            <Link href="/tools/expenses/transactions?kind=支出" className="text-xs font-medium text-[#6F5FD6]">
              查看全部
            </Link>
          </div>
          {breakdown.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
          ) : (
            // 點某一類（例如「居家」）直接跳到紀錄頁、而且已經篩好只剩那一類的明細。
            <div className="mt-4 flex flex-col gap-3">
              {breakdown.slice(0, SUMMARY_LIMIT).map((row) => (
                <Link
                  key={row.category.id}
                  href={`/tools/expenses/transactions?kind=支出&categoryId=${row.category.id}`}
                  className="flex items-center gap-3"
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
            </div>
          )}
        </CardBody>
      </Card>

      {incomeRows.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <p className={text.sectionHeading}>收入來源</p>
              {/* 導去紀錄頁的「收入」分頁看每一天的細項（薪資那種有明細的還可以展開看
                  本薪/勞健保），不是跳到只有彙總圖表的報表頁。 */}
              <Link href="/tools/expenses/transactions?kind=收入" className="text-xs font-medium text-[#6F5FD6]">
                查看全部
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {incomeRows.slice(0, SUMMARY_LIMIT).map((row) => (
                <Link key={row.id} href={`/tools/expenses/transactions?kind=收入&categoryId=${row.id}`} className="flex items-center gap-3">
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
            </div>
          </CardBody>
        </Card>
      )}

      {/* 固定收支的入口：到期的期數在進任何記帳本頁面時就已經自動入帳了（見
          app/tools/expenses/layout.tsx），所以這裡不是「待你確認」的待辦清單，而是
          「這個月已經自動記了什麼」加上「接下來幾天還會自動記什麼」——錢會自己動的那幾筆
          本來就最容易被忘記，首頁要看得到，才不會月底才發現錢少了一塊。 */}
      {(recurringThisMonth.length > 0 || upcoming.length > 0) && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <p className={text.sectionHeading}>固定收支</p>
              <Link href="/tools/expenses/recurring" className="text-xs font-medium text-[#6F5FD6]">
                查看全部
              </Link>
            </div>

            {recurringThisMonth.length > 0 && (
              <p className={`mt-3 ${text.muted}`}>
                本月已自動入帳 <span className="font-semibold text-[#4A3B7C]">{recurringThisMonth.length}</span> 筆・
                <span className="font-semibold text-[#4A3B7C]">{formatCurrency(recurringThisMonthTotal)}</span>
              </p>
            )}

            {upcoming.length > 0 && (
              <>
                <p className={`mt-3 ${text.label}`}>接下來 {UPCOMING_DAYS} 天</p>
                <ul className="mt-2 flex flex-col divide-y divide-[#ECE4FA]">
                  {upcoming.slice(0, SUMMARY_LIMIT).map((item) => {
                    const cat = displayCategoryOf(categories, item.rule.categoryId);
                    const isIncome = cat?.kind === "收入";
                    return (
                      <li key={`${item.rule.id}-${item.date}`} className="flex items-center gap-3 py-2.5 text-sm">
                        <IconAvatar icon={cat?.icon ?? "🔁"} size="sm" className={cat ? categoryColorClass[cat.color] : undefined} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[#4A3B7C]">{item.rule.note || cat?.name || "固定收支"}</p>
                          <p className={text.muted}>{item.date}</p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium" style={{ color: isIncome ? "#2FAE82" : "#4A3B7C" }}>
                          {isIncome ? "＋" : "－"}
                          {formatCurrency(item.rule.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <p className={text.sectionHeading}>最近消費</p>
            <Link href="/tools/expenses/transactions" className="text-xs font-medium text-[#6F5FD6]">
              查看全部
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
          ) : (
            // 跟「查看全部」進去的明細列同一種長相（左圖右文），差別只在首頁這裡每一列
            // 自己帶日期，不照日期分組——首頁只有五筆，為了五筆拆成好幾個日期區塊反而更零碎。
            <ul className="mt-3 flex flex-col divide-y divide-[#ECE4FA]">
              {recent.map((t) => {
                // 子分類沿用大分類的圖示與顏色：「下午茶」顯示的是「餐飲」那顆。
                const cat = displayCategoryOf(categories, t.categoryId);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <IconAvatar icon={cat?.icon ?? "🏷️"} size="sm" className={cat ? categoryColorClass[cat.color] : undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[#4A3B7C]">{transactionDisplayName(t, categories)}</p>
                      <p className={text.muted}>{t.date}</p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium text-[#4A3B7C]">－{formatCurrency(t.amount)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
