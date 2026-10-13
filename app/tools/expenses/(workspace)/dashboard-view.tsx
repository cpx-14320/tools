"use client";

import { useEffect, useState } from "react";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { Card, CardBody } from "@/components/expenses/card";
import { text } from "@/components/expenses/theme";
import { dateFilterRange, previousPeriodSuffix, defaultDateFilter } from "@/lib/expenses/date-filter";
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
import { formatCurrency } from "@/lib/format";

const POSITIVE = "#2FAE82";
const NEGATIVE = "#D1517E";

/** 「較上期 +N%」小字，緊接在金額後面同一行——收入類指標上升是好事用綠色，支出類指標
 *  上升是壞事用珊瑚紅，跟搭乘車 etaToneStyle 那套「依狀態決定色調」是同一個精神，只是
 *  這裡依漲跌方向決定。 */
function DeltaText({ delta, pct, goodWhenUp }: { delta: number; pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return null;
  const isUp = delta >= 0;
  const isGood = isUp === goodWhenUp;
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: isGood ? POSITIVE : NEGATIVE }}>
      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** KPI 卡片：圖示在左（垂直置中）、文字在右（標籤在上、金額＋漲跌幅同一行在下），
 *  比垂直疊三層矮很多。圖示色塊沿用搭乘車路線色塊／即時到站狀態色那幾組現成配色
 *  （藍／橘／紅／綠），不是另外配的新顏色。 */
function KpiCard({
  icon,
  iconBg,
  iconFg,
  label,
  value,
  valueColor,
  delta,
}: {
  icon: string;
  iconBg: string;
  iconFg: string;
  label: string;
  value: string;
  valueColor: string;
  delta: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: iconBg, color: iconFg }}>
          {icon}
        </span>
        <p className={`mt-2 ${text.muted}`}>{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <p className="text-lg font-bold tabular-nums" style={{ color: valueColor }}>
            {value}
          </p>
          {delta}
        </div>
      </CardBody>
    </Card>
  );
}

export function DashboardView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/expenses/categories").then((res) => res.json()), fetch("/api/expenses/transactions").then((res) => res.json())])
      .then(([categoriesData, txData]: [{ categories?: CategoryDTO[] }, { transactions?: TransactionDTO[] }]) => {
        if (cancelled) return;
        setCategories(categoriesData.categories ?? []);
        setTransactions(txData.transactions ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const range = dateFilterRange(filter);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(transactions, r).length > 0;

  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(transactions, categories, range);
  const incomeDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalIncome, filter, hasPriorData);
  const expenseDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).totalExpense, filter, hasPriorData);
  const balanceDelta = rangeDelta((r) => totalsForRange(transactions, categories, r).balance, filter, hasPriorData);
  const deltaSuffix = previousPeriodSuffix(filter.mode);
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

      {/* 收入獨立一整排、支出跟結餘並排各半——收入是看整體財務狀況時最先想看的數字，
          拉成滿版比較醒目；支出跟結餘互相比較的意義比較大（花了多少、剩多少），並排
          方便一眼對照。薪資不再是獨立算出來的特例，就是收入分類加總的其中一塊，想看
          薪資自己漲跌多少，看「收入來源」卡片裡薪資那一列即可，不需要 Dashboard 再
          另外開一組指標。圖示色塊沿用搭乘車既有的路線色塊配色，不是另外配的新顏色。 */}
      <KpiCard
        icon="💰"
        iconBg="#E3F6EC"
        iconFg="#2FAE82"
        label="本月收入"
        value={formatCurrency(totalIncome)}
        valueColor="#4A3B7C"
        delta={incomeDelta && <DeltaText delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp />}
      />
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon="🛍️"
          iconBg="#FDEEF0"
          iconFg="#D1517E"
          label="本月支出"
          value={formatCurrency(totalExpense)}
          valueColor="#4A3B7C"
          delta={expenseDelta && <DeltaText delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} />}
        />
        <KpiCard
          icon="🐷"
          iconBg="#E6EEFC"
          iconFg="#4E7FE0"
          label="本月結餘"
          value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
          valueColor={balance >= 0 ? "#4A3B7C" : NEGATIVE}
          delta={balanceDelta && <DeltaText delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp />}
        />
      </div>
      <p className={`-mt-2 text-right ${text.faint}`}>{deltaSuffix}</p>

      <Card>
        <CardBody>
          <p className={text.sectionHeading}>本月預算</p>
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
                {budget.rows.map((row) => (
                  <div key={row.category.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-[#4A3B7C]">
                        <span className={`grid size-6 place-items-center rounded-full text-xs ${categoryColorClass[row.category.color]}`}>
                          {row.category.icon}
                        </span>
                        {row.category.name}
                      </span>
                      <span className={`tabular-nums ${text.muted}`}>
                        {formatCurrency(row.spent)} / {formatCurrency(row.budgetAmount)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EFFC]">
                      <div
                        className={`h-full rounded-full ${row.pct > 100 ? "bg-[#D1517E]" : categoryFillClass[row.category.color]}`}
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className={text.sectionHeading}>消費分類佔比</p>
          {breakdown.length === 0 ? (
            <p className={`mt-3 ${text.muted}`}>這段期間還沒有消費紀錄。</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {breakdown.map((row) => (
                <div key={row.category.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-[#4A3B7C]">
                      <span className={`grid size-6 place-items-center rounded-full text-xs ${categoryColorClass[row.category.color]}`}>
                        {row.category.icon}
                      </span>
                      {row.category.name}
                    </span>
                    <span className={`tabular-nums ${text.muted}`}>{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EFFC]">
                    <div className={`h-full rounded-full ${categoryFillClass[row.category.color]}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {incomeRows.length > 0 && (
        <Card>
          <CardBody>
            <p className={text.sectionHeading}>收入來源</p>
            <div className="mt-4 flex flex-col gap-3">
              {incomeRows.map((row) => (
                <div key={row.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-[#4A3B7C]">
                      <span className="grid size-6 place-items-center rounded-full bg-[#E3F6EC] text-xs">{row.icon}</span>
                      {row.name}
                    </span>
                    <span className={`tabular-nums ${text.muted}`}>{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EFFC]">
                    <div className="h-full rounded-full bg-[#2FAE82]" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <p className={text.sectionHeading}>最近消費</p>
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
                  <span className="shrink-0 tabular-nums font-medium text-[#4A3B7C]">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
