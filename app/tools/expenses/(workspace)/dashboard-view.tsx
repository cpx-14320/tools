"use client";

import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import {
  categoryBreakdown,
  incomeBreakdown,
  categoryColorClass,
  categoryFillClass,
  dateFilterRange,
  previousPeriodSuffix,
  referenceYearMonth,
  rangeDelta,
  budgetForMonth,
  totalsForRange,
  memberName,
} from "@/lib/expenses/mock-data";
import { formatCurrency } from "@/lib/format";

// 色系直接比照搭乘車的實際色碼，跟 expenses-mobile-shell.tsx／expenses-mobile-nav.tsx
// 同一組，獨立檔案、不 import 搭乘車的元件。
const INK_STRONG = "#4A3B7C";
const INK_MUTED = "#9C94C4";
const BORDER = "#ECE4FA";
const POSITIVE = "#2FAE82";
const NEGATIVE = "#D1517E";

/** 搭乘車卡片的共用視覺語言：白底、rounded-2xl、柔和陰影——這裡直接比照寫，不透過
 *  components/ui.tsx 的 Card（那個元件還是舊色票，其他記帳本頁面現在都還在用，這次只改
 *  首頁，不要連帶把舊頁面也染成新色票）。 */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)] ${className}`}
      style={{ border: `1px solid ${BORDER}` }}
    >
      {children}
    </div>
  );
}

/** 「較上期 +N%」小字——收入類指標上升是好事用綠色，支出類指標上升是壞事用珊瑚紅，
 *  跟搭乘車 etaToneStyle 那套「依狀態決定色調」是同一個精神，只是這裡依漲跌方向決定。 */
function DeltaText({ delta, pct, goodWhenUp }: { delta: number; pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return null;
  const isUp = delta >= 0;
  const isGood = isUp === goodWhenUp;
  return (
    <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: isGood ? POSITIVE : NEGATIVE }}>
      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </p>
  );
}

/** KPI 卡片：圖示用色塊（不是圓形）配色直接沿用搭乘車路線色塊／即時到站狀態色那幾組
 *  現成配色（藍／橘／紅／綠），不是另外配的新顏色。 */
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
      <span className="grid size-9 place-items-center rounded-xl text-base" style={{ background: iconBg, color: iconFg }}>
        {icon}
      </span>
      <p className="mt-2 text-xs" style={{ color: INK_MUTED }}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-lg font-bold tabular-nums" style={{ color: valueColor }}>
        {value}
      </p>
      {delta}
    </Card>
  );
}

export function DashboardView() {
  const { filter } = useDateFilter();
  const range = dateFilterRange(filter);
  const { totalExpense, balance, expenseTx, salaryIncome, extraIncome } = totalsForRange(range);
  const salaryDelta = rangeDelta((r) => totalsForRange(r).salaryIncome, filter);
  const extraIncomeDelta = rangeDelta((r) => totalsForRange(r).extraIncome, filter);
  const expenseDelta = rangeDelta((r) => totalsForRange(r).totalExpense, filter);
  const balanceDelta = rangeDelta((r) => totalsForRange(r).balance, filter);
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
          valueColor={INK_STRONG}
          delta={salaryDelta && <DeltaText delta={salaryDelta.delta} pct={salaryDelta.pct} goodWhenUp />}
        />
        <KpiCard
          icon="🎁"
          iconBg="#FDE7D8"
          iconFg="#D97A3D"
          label="其他收入"
          value={formatCurrency(extraIncome)}
          valueColor={INK_STRONG}
          delta={extraIncomeDelta && <DeltaText delta={extraIncomeDelta.delta} pct={extraIncomeDelta.pct} goodWhenUp />}
        />
        <KpiCard
          icon="🛍️"
          iconBg="#FDEEF0"
          iconFg="#D1517E"
          label="本月支出"
          value={formatCurrency(totalExpense)}
          valueColor={INK_STRONG}
          delta={expenseDelta && <DeltaText delta={expenseDelta.delta} pct={expenseDelta.pct} goodWhenUp={false} />}
        />
        <KpiCard
          icon="🐷"
          iconBg="#E3F6EC"
          iconFg="#2FAE82"
          label="本月結餘"
          value={`${balance >= 0 ? "" : "－"}${formatCurrency(Math.abs(balance))}`}
          valueColor={balance >= 0 ? INK_STRONG : NEGATIVE}
          delta={balanceDelta && <DeltaText delta={balanceDelta.delta} pct={balanceDelta.pct} goodWhenUp />}
        />
      </div>
      <p className="-mt-2 text-right text-[11px]" style={{ color: INK_MUTED }}>
        {deltaSuffix}
      </p>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-semibold" style={{ color: INK_STRONG }}>
            {budgetMonth} 預算
          </p>
          {budget !== undefined && (
            <span className="text-xs" style={{ color: INK_MUTED }}>
              {budgetPct}%
            </span>
          )}
        </div>
        {budget === undefined ? (
          <p className="mt-3 text-sm" style={{ color: INK_MUTED }}>
            這個月還沒有設定預算。
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-xs" style={{ color: INK_MUTED }}>
                  剩餘預算
                </p>
                <p
                  className="mt-0.5 text-xl font-bold tabular-nums"
                  style={{ color: budgetRemaining !== undefined && budgetRemaining < 0 ? NEGATIVE : INK_STRONG }}
                >
                  {formatCurrency(budgetRemaining ?? 0)}
                </p>
              </div>
              <p className="text-xs" style={{ color: INK_MUTED }}>
                已花 {formatCurrency(budgetSpent)} / {formatCurrency(budget)}
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "#F3EFFC" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${budgetPct}%`, background: budgetSpent > budget ? NEGATIVE : "#6F5FD6" }}
              />
            </div>
          </>
        )}
      </Card>

      <Card>
        <p className="font-semibold" style={{ color: INK_STRONG }}>
          消費分類佔比
        </p>
        {breakdown.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: INK_MUTED }}>
            這段期間還沒有消費紀錄。
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {breakdown.map((row) => (
              <div key={row.category.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2" style={{ color: INK_STRONG }}>
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs ${categoryColorClass[row.category.color]}`}
                    >
                      {row.category.icon}
                    </span>
                    {row.category.name}
                  </span>
                  <span className="tabular-nums" style={{ color: INK_MUTED }}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "#F3EFFC" }}>
                  <div
                    className={`h-full rounded-full ${categoryFillClass[row.category.color]}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {incomeRows.length > 0 && (
        <Card>
          <p className="font-semibold" style={{ color: INK_STRONG }}>
            收入來源
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {incomeRows.map((row) => (
              <div key={row.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2" style={{ color: INK_STRONG }}>
                    <span className="grid size-6 place-items-center rounded-full text-xs" style={{ background: "#E3F6EC" }}>
                      {row.icon}
                    </span>
                    {row.name}
                  </span>
                  <span className="tabular-nums" style={{ color: INK_MUTED }}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: "#F3EFFC" }}>
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: POSITIVE }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <p className="font-semibold" style={{ color: INK_STRONG }}>
          最近消費
        </p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: INK_MUTED }}>
            這段期間還沒有消費紀錄。
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-[#ECE4FA]">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate" style={{ color: INK_STRONG }}>
                    {t.note ?? "（無備註）"} <span style={{ color: INK_MUTED }}>· {memberName(t.memberId)}</span>
                  </p>
                  <p className="text-xs" style={{ color: INK_MUTED }}>
                    {t.date}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums font-medium" style={{ color: INK_STRONG }}>
                  {formatCurrency(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
