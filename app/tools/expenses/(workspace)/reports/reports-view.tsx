"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Card, CardBody } from "@/components/expenses/card";
import { SegmentedControl } from "@/components/expenses/button";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { text } from "@/components/expenses/theme";
import { DonutChart, type DonutSlice } from "@/components/expenses/donut-chart";
import { TrendBarChart, NetTrendChart, type TrendSeries } from "@/components/expenses/trend-bar-chart";
import { categoryById, categoryColorHex, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import {
  totalsForRange,
  rangeDelta,
  categoryBreakdown,
  incomeBreakdown,
  trendByPeriod,
  transactionsInDateRange,
  type TransactionDTO,
  type TrendGranularity,
} from "@/lib/expenses/transactions";
import { dateFilterRange, previousPeriodSuffix } from "@/lib/expenses/date-filter";
import { formatCurrency } from "@/lib/format";

type ReportKind = "支出" | "收入" | "淨額";

const GRANULARITY_OPTIONS: { value: TrendGranularity; label: string }[] = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

const PERIOD_OPTIONS_BY_GRANULARITY: Record<TrendGranularity, number[]> = {
  day: [7, 14, 30],
  week: [4, 8, 12],
  month: [3, 6, 12, 24],
  year: [3, 5, 10],
};

const GRANULARITY_UNIT: Record<TrendGranularity, string> = { day: "天", week: "週", month: "月", year: "年" };

const OTHER_COLOR = "#B3ABD4";
const TOP_N = 5;

export function ReportsView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<ReportKind>("支出");
  const [expanded, setExpanded] = useState(false);
  const [granularity, setGranularity] = useState<TrendGranularity>("month");
  const [periods, setPeriods] = useState(6);

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

  // 切換頻率時，循環次數選項也會跟著換（日常見是 7/14/30，月是 3/6/12/24），原本選的
  // 次數如果在新的選項裡找不到，改用那組的第二個常用值當預設，不留一個已經消失的數字。
  function changeGranularity(next: TrendGranularity) {
    setGranularity(next);
    const options = PERIOD_OPTIONS_BY_GRANULARITY[next];
    if (!options.includes(periods)) setPeriods(options[Math.min(1, options.length - 1)]);
  }

  const range = dateFilterRange(filter);
  const deltaSuffix = previousPeriodSuffix(filter.mode);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(transactions, r).length > 0;

  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(transactions, categories, range);
  const summaryTotal = kind === "支出" ? totalExpense : kind === "收入" ? totalIncome : balance;
  const summaryDelta = rangeDelta(
    (r) => {
      const t = totalsForRange(transactions, categories, r);
      return kind === "支出" ? t.totalExpense : kind === "收入" ? t.totalIncome : t.balance;
    },
    filter,
    hasPriorData,
  );

  // categoryBreakdown（支出）回傳的每一列帶完整 CategoryDTO，incomeBreakdown（收入）
  // 回傳的是攤平好的 {id,name,icon}——兩種形狀不一樣，這裡統一轉成同一種，下面的圖表／
  // 列表才不用分別處理兩種資料結構。顏色一律用 categoryById 查回真正的分類拿 color，
  // 查不到（分類被刪了）就退回「其他」那個中性灰。
  const breakdownRaw = kind === "支出" ? categoryBreakdown(expenseTx, categories) : kind === "收入" ? incomeBreakdown(incomeTx, categories) : [];
  const breakdown = breakdownRaw.map((row) => {
    const id = "category" in row ? row.category.id : row.id;
    const name = "category" in row ? row.category.name : row.name;
    const icon = "category" in row ? row.category.icon : row.icon;
    const category = "category" in row ? row.category : categoryById(categories, id);
    return {
      id,
      name,
      icon,
      amount: row.amount,
      pct: row.pct,
      colorHex: category ? categoryColorHex[category.color] : OTHER_COLOR,
      colorClass: category ? categoryColorClass[category.color] : "bg-[#F3EFFC] text-[#9C94C4]",
    };
  });
  const topRows = breakdown.slice(0, TOP_N);
  const restAmount = breakdown.slice(TOP_N).reduce((sum, r) => sum + r.amount, 0);
  const donutTotal = breakdown.reduce((sum, r) => sum + r.amount, 0) || 1;
  const donutData: DonutSlice[] = [
    ...topRows.map((r) => ({ id: r.id, label: r.name, amount: r.amount, colorHex: r.colorHex })),
    ...(restAmount > 0 ? [{ id: "other", label: "其他", amount: restAmount, colorHex: OTHER_COLOR }] : []),
  ];
  const visibleRows = expanded ? breakdown : breakdown.slice(0, TOP_N);

  const trendPoints = useMemo(
    () => (kind !== "淨額" ? trendByPeriod(transactions, categories, kind, granularity, periods) : []),
    [transactions, categories, kind, granularity, periods],
  );
  const incomeTrendPoints = useMemo(
    () => (kind === "淨額" ? trendByPeriod(transactions, categories, "收入", granularity, periods) : []),
    [transactions, categories, kind, granularity, periods],
  );
  const expenseTrendPoints = useMemo(
    () => (kind === "淨額" ? trendByPeriod(transactions, categories, "支出", granularity, periods) : []),
    [transactions, categories, kind, granularity, periods],
  );

  // 趨勢圖的分類顏色／順序固定用「這段期間加總後最大的前幾名」決定，不是每一期各自排序
  // ——不然同一個分類在不同期的長條裡顏色跟位置會亂跳，趨勢圖就失去「對照」的意義。
  const trendSeries: TrendSeries[] = useMemo(() => {
    if (kind === "淨額") return [];
    const totalsByCategory = new Map<string, number>();
    for (const p of trendPoints) {
      for (const b of p.byCategory) totalsByCategory.set(b.categoryId, (totalsByCategory.get(b.categoryId) ?? 0) + b.amount);
    }
    const sorted = [...totalsByCategory.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N).reduce((sum, [, amount]) => sum + amount, 0);
    const series: TrendSeries[] = top.map(([categoryId]) => {
      const category = categories.find((c) => c.id === categoryId);
      return { id: categoryId, label: category?.name ?? "（已刪除分類）", colorHex: category ? categoryColorHex[category.color] : OTHER_COLOR };
    });
    if (rest > 0) series.push({ id: "__other__", label: "其他", colorHex: OTHER_COLOR });
    return series;
  }, [trendPoints, categories, kind]);

  // trendPoints 的 byCategory 只有真正的分類 id；上面算出「其他」桶之後，沒進前幾名的
  // 分類金額要重新併進 __other__ 這個鍵，長條圖才看得到那一截。
  const trendPointsWithOther = useMemo(() => {
    if (kind === "淨額") return [];
    const topIds = new Set(trendSeries.filter((s) => s.id !== "__other__").map((s) => s.id));
    return trendPoints.map((p) => {
      let otherAmount = 0;
      const byCategory = p.byCategory.filter((b) => {
        if (topIds.has(b.categoryId)) return true;
        otherAmount += b.amount;
        return false;
      });
      if (otherAmount > 0) byCategory.push({ categoryId: "__other__", amount: otherAmount });
      return { ...p, byCategory };
    });
  }, [trendPoints, trendSeries, kind]);

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="報表" />
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="報表" />

      <SegmentedControl
        value={kind}
        onChange={(v) => {
          setKind(v);
          setExpanded(false);
        }}
        options={[
          { value: "支出", label: "支出" },
          { value: "收入", label: "收入" },
          { value: "淨額", label: "淨額" },
        ]}
      />

      <DateFilterPicker />

      <Card>
        <CardBody>
          <p className={text.muted}>{kind === "淨額" ? "這段期間結餘" : `這段期間${kind}`}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <p className="text-2xl font-bold tabular-nums text-[#4A3B7C]">
              {summaryTotal < 0 ? "－" : ""}
              {formatCurrency(Math.abs(summaryTotal))}
            </p>
            {summaryDelta && <DeltaBadge delta={summaryDelta.delta} pct={summaryDelta.pct} goodWhenUp={kind !== "支出"} suffix={deltaSuffix} />}
          </div>
        </CardBody>
      </Card>

      {kind !== "淨額" && (
        <Card>
          <CardBody>
            <p className={text.sectionHeading}>明細</p>
            {breakdown.length === 0 ? (
              <p className={`mt-3 ${text.muted}`}>這段期間還沒有{kind}紀錄。</p>
            ) : (
              <>
                <div className="mt-4 flex items-center gap-5">
                  <DonutChart data={donutData} />
                  <div className="flex flex-1 flex-col gap-2">
                    {donutData.slice(0, TOP_N).map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[#4A3B7C]">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.colorHex }} />
                          {d.label}
                        </span>
                        <span className={`tabular-nums ${text.muted}`}>{((d.amount / donutTotal) * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-[#F2EEFA] pt-4">
                  {visibleRows.map((row) => (
                    <div key={row.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-[#4A3B7C]">
                          <span className={`grid size-6 place-items-center rounded-full text-xs ${row.colorClass}`}>{row.icon}</span>
                          {row.name}
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="tabular-nums text-[#4A3B7C]">{formatCurrency(row.amount)}</span>
                          <span className={`tabular-nums ${text.faint}`}>{row.pct}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F3EFFC]">
                        <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.colorHex }} />
                      </div>
                    </div>
                  ))}
                </div>
                {breakdown.length > TOP_N && (
                  <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs font-medium text-[#6F5FD6]">
                    {expanded ? "收合" : `顯示全部 (${breakdown.length})`}
                  </button>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={text.sectionHeading}>趨勢</p>
            <SegmentedControl value={granularity} onChange={changeGranularity} options={GRANULARITY_OPTIONS} />
          </div>
          <div className="mt-3 flex gap-1.5">
            {PERIOD_OPTIONS_BY_GRANULARITY[granularity].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPeriods(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${periods === n ? "bg-[#6F5FD6] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"}`}
              >
                近 {n}
                {GRANULARITY_UNIT[granularity]}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {kind === "淨額" ? (
              <NetTrendChart incomePoints={incomeTrendPoints} expensePoints={expenseTrendPoints} formatValue={formatCurrency} />
            ) : (
              <TrendBarChart points={trendPointsWithOther} series={trendSeries} formatValue={formatCurrency} />
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
