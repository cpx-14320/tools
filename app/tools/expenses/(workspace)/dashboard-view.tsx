"use client";

import { useEffect, useState } from "react";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { Card, CardBody } from "@/components/expenses/card";
import { text } from "@/components/expenses/theme";
import { dateFilterRange, previousPeriodSuffix } from "@/lib/expenses/date-filter";
import { categoryColorClass, categoryFillClass, type CategoryDTO } from "@/lib/expenses/categories";
import { totalsForRange, rangeDelta, categoryBreakdown, incomeBreakdown, transactionsInDateRange, type TransactionDTO } from "@/lib/expenses/transactions";
import { salaryNet, salaryRecordsInDateRange, type SalaryRecordDTO } from "@/lib/expenses/salary-records";
import type { SalaryItemTypeDTO } from "@/lib/expenses/salary-types";
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
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecordDTO[]>([]);
  const [salaryTypes, setSalaryTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/salary-records").then((res) => res.json()),
      fetch("/api/expenses/salary-types").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, salaryData, typesData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { records?: SalaryRecordDTO[] },
          { types?: SalaryItemTypeDTO[] },
        ]) => {
          if (cancelled) return;
          setCategories(categoriesData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setSalaryRecords(salaryData.records ?? []);
          setSalaryTypes(typesData.types ?? []);
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

  const range = dateFilterRange(filter);
  const salaryIncomeForRange = (r: ReturnType<typeof dateFilterRange>) =>
    salaryRecordsInDateRange(salaryRecords, r).reduce((sum, rec) => sum + salaryNet(rec, salaryTypes), 0);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) =>
    transactionsInDateRange(transactions, r).length > 0 || salaryRecordsInDateRange(salaryRecords, r).length > 0;

  const { totalExpense, balance, expenseTx, salaryIncome, extraIncome } = totalsForRange(transactions, categories, range, salaryIncomeForRange(range));
  const salaryDelta = rangeDelta((r) => salaryIncomeForRange(r), filter, hasPriorData);
  const extraIncomeDelta = rangeDelta((r) => totalsForRange(transactions, categories, r, salaryIncomeForRange(r)).extraIncome, filter, hasPriorData);
  const expenseDelta = rangeDelta((r) => totalsForRange(transactions, categories, r, salaryIncomeForRange(r)).totalExpense, filter, hasPriorData);
  const balanceDelta = rangeDelta((r) => totalsForRange(transactions, categories, r, salaryIncomeForRange(r)).balance, filter, hasPriorData);
  const deltaSuffix = previousPeriodSuffix(filter.mode);
  const breakdown = categoryBreakdown(expenseTx, categories);
  const incomeRows = incomeBreakdown(totalsForRange(transactions, categories, range, salaryIncome).incomeTx, categories, salaryIncome);
  const recent = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  // 預算功能還沒做（不在這次範圍內），固定顯示「還沒設定預算」。
  const budget: number | undefined = undefined;

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

      {/* 薪水／其他收入／支出／結餘四格——薪水跟薪水以外的收入故意分開顯示，不是只看
          「總收入」，呼應之後要做的薪資漲幅分析：總收入漲，不代表固定薪水真的調高了。
          圖示色塊沿用搭乘車既有的路線色塊配色（藍／橘／紅／綠），不是另外配的新顏色。 */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon="💼"
          iconBg="#E6EEFC"
          iconFg="#4E7FE0"
          label="本月薪水"
          value={formatCurrency(salaryIncome)}
          valueColor="#4A3B7C"
          delta={salaryDelta && <DeltaText delta={salaryDelta.delta} pct={salaryDelta.pct} goodWhenUp />}
        />
        <KpiCard
          icon="🎁"
          iconBg="#FDE7D8"
          iconFg="#D97A3D"
          label="其他收入"
          value={formatCurrency(extraIncome)}
          valueColor="#4A3B7C"
          delta={extraIncomeDelta && <DeltaText delta={extraIncomeDelta.delta} pct={extraIncomeDelta.pct} goodWhenUp />}
        />
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
          iconBg="#E3F6EC"
          iconFg="#2FAE82"
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
          {budget === undefined && <p className={`mt-3 ${text.muted}`}>這個月還沒有設定預算。</p>}
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
