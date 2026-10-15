"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { Card, CardBody } from "@/components/expenses/card";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text, gradient, shadow } from "@/components/expenses/theme";
import { dateFilterRange, defaultDateFilter } from "@/lib/expenses/date-filter";
import { categoryColorClass, categoryFillClass, type CategoryDTO } from "@/lib/expenses/categories";
import {
  totalsForRange,
  rangeDelta,
  categoryBreakdown,
  incomeBreakdown,
  budgetSummary,
  transactionsInDateRange,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = 5;

export function DashboardView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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
  const incomeDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalIncome, filter, hasPriorData);
  const expenseDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalExpense, filter, hasPriorData);
  const balanceDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).balance, filter, hasPriorData);
  const breakdown = categoryBreakdown(expenseTx, categories);
  const incomeRows = incomeBreakdown(incomeTx, categories);
  const recent = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  // 預算卡片故意不跟著上面的日期篩選器走——預算本來就是「這個月」的概念，篩選器切到
  // 別的區間（例如去年、自訂區間）時，預算對比還是要看真正的這個月，不是篩選器選的那段。
  const thisMonthExpenseTx = totalsForRange(transactions, categories, dateFilterRange(defaultDateFilter())).expenseTx;
  const budget = budgetSummary(thisMonthExpenseTx, categories);

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

      <TransactionModal
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
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="新增交易"
        className="fixed right-5 z-20 grid size-14 place-items-center rounded-full text-3xl font-bold leading-none text-white"
        style={{ background: gradient.primary, boxShadow: shadow.cta, bottom: "calc(env(safe-area-inset-bottom) + 86px)" }}
      >
        ＋
      </button>

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
            <p className={text.sectionHeading}>本月預算</p>
            <Link href="/tools/expenses/categories" className="text-xs font-medium text-[#6F5FD6]">
              管理分類
            </Link>
          </div>
          {budget.rows.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>還沒有分類設定預算，到「消費分類」編輯分類時可以加一個。</p>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className={text.statValue}>
                  {formatCurrency(budget.totalSpent)}
                  <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(budget.totalBudget)}</span>
                </p>
                <span className={`text-xs font-semibold ${budget.pct > 100 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{budget.pct}%</span>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {budget.rows.slice(0, SUMMARY_LIMIT).map((row) => (
                  <div key={row.category.id} className="flex items-center gap-3">
                    <ListProgressRow
                      icon={row.category.icon}
                      iconClassName={categoryColorClass[row.category.color]}
                      name={row.category.name}
                      amount={`${formatCurrency(row.spent)} / ${formatCurrency(row.budgetAmount)}`}
                      pct={row.pct}
                      pctLabel={<span className={row.pct > 100 ? "text-[#D1517E]" : undefined}>{row.pct}%</span>}
                      barColorClass={row.pct > 100 ? "bg-[#D1517E]" : categoryFillClass[row.category.color]}
                    />
                  </div>
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
            <Link href="/tools/expenses/reports" className="text-xs font-medium text-[#6F5FD6]">
              查看完整報表
            </Link>
          </div>
          {breakdown.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {breakdown.slice(0, SUMMARY_LIMIT).map((row) => (
                <div key={row.category.id} className="flex items-center gap-3">
                  <ListProgressRow
                    icon={row.category.icon}
                    iconClassName={categoryColorClass[row.category.color]}
                    name={row.category.name}
                    amount={formatCurrency(row.amount)}
                    pct={row.pct}
                    barColorClass={categoryFillClass[row.category.color]}
                  />
                </div>
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
              <Link href="/tools/expenses/reports" className="text-xs font-medium text-[#6F5FD6]">
                查看完整報表
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {incomeRows.slice(0, SUMMARY_LIMIT).map((row) => (
                <div key={row.id} className="flex items-center gap-3">
                  <ListProgressRow
                    icon={row.icon}
                    iconClassName="bg-[#E3F6EC] text-[#2FAE82]"
                    name={row.name}
                    amount={formatCurrency(row.amount)}
                    pct={row.pct}
                    barColorClass="bg-[#2FAE82]"
                  />
                </div>
              ))}
            </div>
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
            <ul className="mt-3 flex flex-col divide-y divide-[#ECE4FA]">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-[#4A3B7C]">{t.note ?? "（無備註）"}</p>
                    <p className={text.muted}>{t.date}</p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium text-[#4A3B7C]">－{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
