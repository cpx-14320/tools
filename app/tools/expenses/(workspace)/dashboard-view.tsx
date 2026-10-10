"use client";

import { Card, CardBody, DeltaBadge } from "@/components/ui";
import { DashboardIllustration } from "@/components/expenses/illustrations";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import {
  categoryBreakdown,
  incomeBreakdown,
  categoryColorClass,
  categoryFillClass,
  dateFilterRange,
  dateFilterLabel,
  previousPeriodSuffix,
  referenceYearMonth,
  rangeDelta,
  budgetForMonth,
  totalsForRange,
  memberName,
} from "@/lib/expenses/mock-data";
import { formatCurrency } from "@/lib/format";

export function DashboardView() {
  const { filter } = useDateFilter();
  const range = dateFilterRange(filter);
  const { totalIncome, totalExpense, balance, expenseTx } = totalsForRange(range);
  const incomeDelta = rangeDelta((r) => totalsForRange(r).totalIncome, filter);
  const expenseDelta = rangeDelta((r) => totalsForRange(r).totalExpense, filter);
  const deltaSuffix = previousPeriodSuffix(filter.mode);
  const breakdown = categoryBreakdown(range);
  const incomeRows = incomeBreakdown(range);
  const recent = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  const budgetMonth = referenceYearMonth(filter);
  const budget = budgetForMonth(budgetMonth);
  const budgetMonthRange = dateFilterRange({ ...filter, mode: "month" });
  const budgetSpent = totalsForRange(budgetMonthRange).totalExpense;
  const budgetRemaining = budget !== undefined ? budget - budgetSpent : undefined;
  const budgetPct = budget ? Math.min(100, Math.round((budgetSpent / budget) * 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      <DateFilterPicker />

      <div
        className="relative overflow-hidden rounded-[1.75rem] p-5 text-brand"
        style={{ background: "linear-gradient(135deg, #FDEBE4, var(--pink) 55%, var(--violet))" }}
      >
        <DashboardIllustration className="pointer-events-none absolute right-0 top-0 h-full w-32 opacity-95" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{dateFilterLabel(filter)}結餘</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
            {balance >= 0 ? "" : "－"}
            {formatCurrency(Math.abs(balance))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] border border-line bg-surface p-4">
          <p className="text-xs text-muted">總收入</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(totalIncome)}</p>
          {incomeDelta && (
            <DeltaBadge delta={incomeDelta.delta} pct={incomeDelta.pct} goodWhenUp suffix={deltaSuffix} className="mt-0.5" />
          )}
        </div>
        <div className="rounded-[1.5rem] border border-line bg-surface p-4">
          <p className="text-xs text-muted">總支出</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(totalExpense)}</p>
          {expenseDelta && (
            <DeltaBadge
              delta={expenseDelta.delta}
              pct={expenseDelta.pct}
              goodWhenUp={false}
              suffix={deltaSuffix}
              className="mt-0.5"
            />
          )}
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <p className="font-semibold">{budgetMonth} 預算</p>
            {budget !== undefined && <span className="text-xs text-muted">{budgetPct}%</span>}
          </div>
          {budget === undefined ? (
            <p className="mt-3 text-sm text-muted">這個月還沒有設定預算。</p>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted">剩餘預算</p>
                  <p
                    className={`mt-0.5 text-xl font-bold tabular-nums ${
                      budgetRemaining !== undefined && budgetRemaining < 0 ? "text-negative" : ""
                    }`}
                  >
                    {formatCurrency(budgetRemaining ?? 0)}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  已花 {formatCurrency(budgetSpent)} / {formatCurrency(budget)}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${budgetSpent > budget ? "bg-negative" : "bg-brand"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="font-semibold">消費分類佔比</p>
          {breakdown.length === 0 ? (
            <p className="mt-3 text-sm text-muted">這段期間還沒有消費紀錄。</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {breakdown.map((row) => (
                <div key={row.category.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={`grid size-6 place-items-center rounded-full text-xs ${categoryColorClass[row.category.color]}`}
                      >
                        {row.category.icon}
                      </span>
                      {row.category.name}
                    </span>
                    <span className="tabular-nums text-muted">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${categoryFillClass[row.category.color]}`}
                      style={{ width: `${row.pct}%` }}
                    />
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
            <p className="font-semibold">收入來源</p>
            <div className="mt-4 flex flex-col gap-3">
              {incomeRows.map((row) => (
                <div key={row.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="grid size-6 place-items-center rounded-full bg-positive-soft text-xs">{row.icon}</span>
                      {row.name}
                    </span>
                    <span className="tabular-nums text-muted">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-positive" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <p className="font-semibold">最近消費</p>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">這段期間還沒有消費紀錄。</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {t.note ?? "（無備註）"} <span className="text-muted">· {memberName(t.memberId)}</span>
                    </p>
                    <p className="text-xs text-muted">{t.date}</p>
                  </div>
                  <span className="shrink-0 tabular-nums font-medium">{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
