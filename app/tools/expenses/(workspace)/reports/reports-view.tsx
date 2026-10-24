"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Card, CardBody } from "@/components/expenses/card";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { SegmentedControl } from "@/components/expenses/button";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { text } from "@/components/expenses/theme";
import { DonutChart, type DonutSlice } from "@/components/expenses/donut-chart";
import { TrendBarChart, NetTrendChart, AssetTrendChart, type TrendSeries } from "@/components/expenses/trend-bar-chart";
import { KpiCard, DeltaText, KPI_NEGATIVE } from "@/components/expenses/kpi-card";
import { AssetComparePicker } from "@/components/expenses/asset-compare-picker";
import { accountBalance, accountsByKind, balanceDelta, netWorth, netWorthAt, sumByAccountType, totalByKind, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, accountTypeColorClass, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { assetCompareDate, defaultAssetCompareSetting, type AssetCompareSetting } from "@/lib/expenses/asset-compare";
import { categoryById, categoryColorHex, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import {
  totalsForRange,
  rangeDelta,
  categoryBreakdown,
  incomeBreakdown,
  trendByPeriod,
  trendPeriods,
  subcategoryBreakdown,
  transactionsInDateRange,
  type TransactionDTO,
  type TrendGranularity,
  type TrendPoint,
} from "@/lib/expenses/transactions";
import { dateFilterRange, previousPeriodSuffix } from "@/lib/expenses/date-filter";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { formatCurrency } from "@/lib/format";

type ReportKind = "支出" | "收入" | "淨額" | "資產";

// 帳戶類型沒有自己的圖表配色，資產配置圖借用分類佔比圖同一組色票循環上色。
const ASSET_TYPE_COLORS = Object.values(categoryColorHex);

const ASSET_COMPARE_STORAGE_KEY = "cpx-tools:expenses-asset-compare";

function loadSavedAssetCompare(): AssetCompareSetting | null {
  try {
    const raw = localStorage.getItem(ASSET_COMPARE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.mode === "string") return parsed as AssetCompareSetting;
  } catch {
    /* 私密視窗等情況或資料壞掉，忽略，用預設值 */
  }
  return null;
}

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
const TOP_N = PREVIEW_COUNT;

export function ReportsView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<ReportKind>("支出");
  const [expanded, setExpanded] = useState(false);
  const [granularity, setGranularity] = useState<TrendGranularity>("month");
  const [periods, setPeriods] = useState(6);
  // 趨勢圖目前展開細項的那一期（用 TrendPoint.start 當 key）；null＝沒有展開任何一根。
  const [selectedTrendStart, setSelectedTrendStart] = useState<string | null>(null);
  // 明細裡目前展開看子分類的那個大分類；null＝全部收合。
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  // 資產分頁的比較基準（跟上面的日期篩選器無關——資產比的是「現在 vs 某一天」的餘額差，
  // 見 lib/expenses/asset-compare.ts）。記在 localStorage，下次進來不用重選。
  const [assetCompare, setAssetCompareState] = useState<AssetCompareSetting>(defaultAssetCompareSetting);
  // 「今天」掛載時算一次固定住——render 當中讀時鐘是不純的。
  const [todayISO] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const saved = loadSavedAssetCompare();
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (saved) setAssetCompareState(saved);
  }, []);

  function setAssetCompare(next: AssetCompareSetting) {
    setAssetCompareState(next);
    try {
      localStorage.setItem(ASSET_COMPARE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 忽略 */
    }
  }

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
        ([categoriesData, txData, accountsData, typesData, transfersData]: [
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
          setAccountTypes(typesData.accountTypes ?? []);
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

  // 切換頻率時，循環次數選項也會跟著換（日常見是 7/14/30，月是 3/6/12/24），原本選的
  // 次數如果在新的選項裡找不到，改用那組的第二個常用值當預設，不留一個已經消失的數字。
  function changeGranularity(next: TrendGranularity) {
    setGranularity(next);
    const options = PERIOD_OPTIONS_BY_GRANULARITY[next];
    if (!options.includes(periods)) setPeriods(options[Math.min(1, options.length - 1)]);
    setSelectedTrendStart(null); // 頻率一變，每一根長條代表的區間就全部不一樣了，展開的細項沒有意義
  }

  function changePeriods(next: number) {
    setPeriods(next);
    setSelectedTrendStart(null);
  }

  // ── 資產分頁 ────────────────────────────────────────────────────────────────
  // 餘額函式本來就是「傳進去哪些交易／轉帳就算哪些」，把資料篩成「日期 <= 基準日」再算
  // 一次，就是那一天當時的數字（見 lib/expenses/asset-compare.ts）。
  const assetAccounts = accountsByKind(accounts, accountTypes, "asset");
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const totalAssets = totalByKind(accounts, accountTypes, transactions, categories, transfers, "asset");
  const totalLiabilities = totalByKind(accounts, accountTypes, transactions, categories, transfers, "liability");

  const compareDate = assetCompareDate(assetCompare, todayISO);
  const compareTx = compareDate ? transactions.filter((t) => t.date <= compareDate) : [];
  const compareTransfers = compareDate ? transfers.filter((t) => t.date <= compareDate) : [];
  const netDelta = compareDate ? balanceDelta(net, netWorth(accounts, accountTypes, compareTx, categories, compareTransfers)) : null;
  const assetsDelta = compareDate
    ? balanceDelta(totalAssets, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "asset"))
    : null;
  const liabilitiesDelta = compareDate
    ? balanceDelta(totalLiabilities, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "liability"))
    : null;

  const assetTypeTotals = sumByAccountType(assetAccounts, accountTypes, transactions, categories, transfers);
  const assetTypeSum = [...assetTypeTotals.values()].reduce((sum, v) => sum + v, 0) || 1;
  const assetTypeBreakdown = [...assetTypeTotals.entries()]
    .map(([typeId, amount], i) => ({
      id: typeId,
      name: accountTypeById(accountTypes, typeId)?.name ?? "（未知類型）",
      amount,
      pct: (amount / assetTypeSum) * 100,
      colorHex: ASSET_TYPE_COLORS[i % ASSET_TYPE_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);
  const assetTypeDonutData: DonutSlice[] = assetTypeBreakdown.map((r) => ({ id: r.id, label: r.name, amount: r.amount, colorHex: r.colorHex }));
  const assetTypeColor = new Map(assetTypeBreakdown.map((r) => [r.id, r.colorHex]));

  // 圓餅是按「類型」分，下面這份清單是按「帳戶」列——跟支出分頁「圓餅看大分類、清單看
  // 細項」同一個層次關係。顏色沿用該帳戶所屬類型在圓餅上的顏色，兩邊對得起來。
  const assetAccountRows = assetAccounts
    .map((a) => {
      const balance = accountBalance(a, accountTypes, transactions, categories, transfers);
      return {
        id: a.id,
        name: a.name,
        icon: accountTypeById(accountTypes, a.accountTypeId)?.icon ?? "❓",
        iconClassName: accountTypeColorClass(accountTypes, a.accountTypeId),
        amount: balance,
        pct: (balance / assetTypeSum) * 100,
        colorHex: assetTypeColor.get(a.accountTypeId) ?? OTHER_COLOR,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 淨資產趨勢：每一期取「那一期最後一天當時」的淨資產，期間切法跟收支趨勢共用同一個
  // trendPeriods，兩張圖的 X 軸才一致。
  const assetTrendPoints = useMemo(
    () =>
      kind === "資產"
        ? trendPeriods(granularity, periods).map((p) => ({
            label: p.label,
            value: netWorthAt(accounts, accountTypes, transactions, categories, transfers, p.end),
          }))
        : [],
    [kind, granularity, periods, accounts, accountTypes, transactions, categories, transfers],
  );

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
    () => (kind === "支出" || kind === "收入" ? trendByPeriod(transactions, categories, kind, granularity, periods) : []),
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

  // 點某一根長條展開的細項——故意用 trendPoints 的原始 byCategory（不是上面併過「其他」
  // 的 trendPointsWithOther），展開細項就是要看「其他」裡到底藏了哪些分類，不應該連
  // 展開之後都還是收在一起。
  function categoryRows(point: TrendPoint): { id: string; name: string; icon: string; colorClass: string; amount: number }[] {
    return point.byCategory
      .map((b) => {
        const category = categories.find((c) => c.id === b.categoryId);
        return {
          id: b.categoryId,
          name: category?.name ?? "（已刪除分類）",
          icon: category?.icon ?? "❓",
          colorClass: category ? categoryColorClass[category.color] : "bg-[#F3EFFC] text-[#9C94C4]",
          amount: b.amount,
        };
      })
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }

  function periodRangeLabel(point: TrendPoint): string {
    return point.start === point.end ? point.start : `${point.start} ～ ${point.end}`;
  }

  const selectedPoint = kind !== "淨額" ? (trendPoints.find((p) => p.start === selectedTrendStart) ?? null) : null;
  const selectedIncomePoint = kind === "淨額" ? (incomeTrendPoints.find((p) => p.start === selectedTrendStart) ?? null) : null;
  const selectedExpensePoint = kind === "淨額" ? (expenseTrendPoints.find((p) => p.start === selectedTrendStart) ?? null) : null;

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
          setSelectedTrendStart(null);
        }}
        fullWidth
        size="lg"
        options={[
          { value: "支出", label: "支出" },
          { value: "收入", label: "收入" },
          { value: "淨額", label: "淨額" },
          { value: "資產", label: "資產" },
        ]}
      />

      {/* 資產看的是「某一天當時有多少」，不是「一段期間內發生多少」，所以這一頁的時間
          控制換成基準日選擇器，日期區間篩選器對它沒有意義。 */}
      {kind === "資產" ? <AssetComparePicker setting={assetCompare} onChange={setAssetCompare} /> : <DateFilterPicker />}

      {kind === "資產" ? (
        <>
          <div className="flex flex-col gap-3">
            <KpiCard
              label="淨資產"
              value={`${net >= 0 ? "" : "－"}${formatCurrency(Math.abs(net))}`}
              valueColor={net < 0 ? KPI_NEGATIVE : "#4A3B7C"}
              delta={netDelta && <DeltaText delta={netDelta.delta} pct={netDelta.pct} goodWhenUp />}
            />
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="資產"
                value={formatCurrency(totalAssets)}
                valueColor="#4A3B7C"
                delta={assetsDelta && <DeltaText delta={assetsDelta.delta} pct={assetsDelta.pct} goodWhenUp />}
              />
              <KpiCard
                label="負債"
                value={formatCurrency(totalLiabilities)}
                valueColor="#4A3B7C"
                delta={liabilitiesDelta && <DeltaText delta={liabilitiesDelta.delta} pct={liabilitiesDelta.pct} goodWhenUp={false} />}
              />
            </div>
          </div>

          <Card>
            <CardBody>
              <p className={text.sectionHeading}>資產配置</p>
              {assetTypeBreakdown.length === 0 ? (
                <p className={`mt-3 ${text.muted}`}>還沒有任何資產帳戶。</p>
              ) : (
                <div className="mt-4 flex items-center gap-5">
                  <DonutChart data={assetTypeDonutData} size={120} />
                  {/* 圖例只有「類型名稱＋佔比」，跟支出分頁的圓餅圖例一字不差——金額跟
                      增減都在下面那排帳戶列（還有上面的 KPI）看得到，圖例再寫一次只是
                      把這一小塊擠滿數字。 */}
                  <div className="flex flex-1 flex-col gap-2">
                    {assetTypeBreakdown.map((row) => (
                      <div key={row.id} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-[#4A3B7C]">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.colorHex }} />
                          {row.name}
                        </span>
                        <span className={`tabular-nums ${text.muted}`}>{row.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 圓餅下面列出每個資產帳戶，樣式跟支出分頁的分類清單一樣（ListProgressRow），
                  差別只在這裡的「佔比」是佔總資產、顏色跟著它所屬的類型。 */}
              {assetAccountRows.length > 0 && (
                <div className="mt-5 flex flex-col gap-3 border-t border-[#F2EEFA] pt-4">
                  {assetAccountRows.map((row) => (
                    // ListProgressRow 只回傳「圖示＋文字區塊」的片段，外層容器要自己包成
                    // 一列（跟下面支出分頁的分類列同一種寫法），不然會被攤成直的一條。
                    <div key={row.id} className="flex w-full items-center gap-3">
                      <ListProgressRow
                        icon={row.icon}
                        iconClassName={row.iconClassName}
                        name={row.name}
                        amount={formatCurrency(row.amount)}
                        pct={row.pct}
                        pctLabel={`${row.pct.toFixed(1)}%`}
                        barColorHex={row.colorHex}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

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
                    onClick={() => changePeriods(n)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${periods === n ? "bg-[#6F5FD6] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"}`}
                  >
                    近 {n}
                    {GRANULARITY_UNIT[granularity]}
                  </button>
                ))}
              </div>
              {/* 每一根是「那一期最後一天當時的淨資產」，不是那一期的收支加總——這張圖
                  回答的是「我的錢有沒有變多」，不是「這個月花了多少」。 */}
              <div className="mt-5">
                <AssetTrendChart points={assetTrendPoints} formatValue={formatCurrency} />
              </div>
            </CardBody>
          </Card>
        </>
      ) : (
        <>

      <Card>
        <CardBody>
          <p className={text.muted}>{kind === "淨額" ? "這段期間結餘" : `這段期間${kind}`}</p>
          <div className="mt-1 flex flex-col gap-1.5">
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
                  <DonutChart data={donutData} size={120} />
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

                {/* 點一列展開它的子分類金額——子分類的花費本來只有「幾筆」看得到，
                    金額全部被捲進大分類裡，等於拆了子分類也看不出差別。沒有子分類、
                    也沒有直接記在大分類身上的那種（只有一列）就不給展開，點了也只是
                    把同一個數字再寫一次。 */}
                <div className="mt-5 flex flex-col gap-3 border-t border-[#F2EEFA] pt-4">
                  {visibleRows.map((row) => {
                    const subRows = subcategoryBreakdown(kind === "支出" ? expenseTx : incomeTx, categories, row.id);
                    const canExpand = subRows.length > 1;
                    const isExpanded = expandedCategoryId === row.id;
                    return (
                      <div key={row.id}>
                        <button
                          type="button"
                          disabled={!canExpand}
                          onClick={() => setExpandedCategoryId(isExpanded ? null : row.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <ListProgressRow
                            icon={row.icon}
                            iconClassName={row.colorClass}
                            name={
                              canExpand ? (
                                <span className="flex items-center gap-1">
                                  {row.name}
                                  <span aria-hidden className={`text-[10px] text-[#C7BFE6] transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                                    ▼
                                  </span>
                                </span>
                              ) : (
                                row.name
                              )
                            }
                            amount={formatCurrency(row.amount)}
                            pct={row.pct}
                            barColorHex={row.colorHex}
                          />
                        </button>
                        {isExpanded && (
                          <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-[#ECE4FA] pl-3 ml-[18px]">
                            {subRows.map((sub) => (
                              <div key={sub.id || "self"} className="flex items-center justify-between gap-2 text-xs">
                                <span className={`min-w-0 truncate ${sub.id ? "text-[#4A3B7C]" : text.muted}`}>{sub.name}</span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="tabular-nums font-medium text-[#4A3B7C]">{formatCurrency(sub.amount)}</span>
                                  <span className={`tabular-nums ${text.faint}`}>{sub.pct}%</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {breakdown.length > TOP_N && (
                  <ExpandToggle expanded={expanded} total={breakdown.length} onToggle={() => setExpanded((v) => !v)} />
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
                onClick={() => changePeriods(n)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${periods === n ? "bg-[#6F5FD6] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"}`}
              >
                近 {n}
                {GRANULARITY_UNIT[granularity]}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {kind === "淨額" ? (
              <NetTrendChart
                incomePoints={incomeTrendPoints}
                expensePoints={expenseTrendPoints}
                formatValue={formatCurrency}
                selected={selectedTrendStart}
                onSelect={(start) => setSelectedTrendStart((cur) => (cur === start ? null : start))}
              />
            ) : (
              <TrendBarChart
                points={trendPointsWithOther}
                series={trendSeries}
                formatValue={formatCurrency}
                selected={selectedTrendStart}
                onSelect={(start) => setSelectedTrendStart((cur) => (cur === start ? null : start))}
              />
            )}
          </div>

          {/* 點長條展開：這一期的年月日範圍、各分類的花費細項（原始分類，不是圖上
              併進「其他」的那份收合版）、跟總計——手機沒辦法 hover 看明細，點開
              才是唯一能看到完整拆項的地方。 */}
          {(selectedPoint || selectedIncomePoint || selectedExpensePoint) && (
            <div className="mt-4 rounded-2xl border border-[#ECE4FA] bg-[#F9F7FE] p-4">
              {selectedPoint && (
                <>
                  <div className="flex items-center justify-between">
                    <p className={text.body}>{periodRangeLabel(selectedPoint)}</p>
                    <p className="text-sm font-semibold tabular-nums text-[#4A3B7C]">{formatCurrency(selectedPoint.total)}</p>
                  </div>
                  <div className="mt-3 flex flex-col divide-y divide-[#ECE4FA]">
                    {categoryRows(selectedPoint).map((r) => (
                      <div key={r.id} className="flex items-center gap-3 py-2">
                        <IconAvatar icon={r.icon} size="sm" className={r.colorClass} />
                        <span className={`min-w-0 flex-1 truncate ${text.body}`}>{r.name}</span>
                        <span className="shrink-0 tabular-nums text-sm font-medium text-[#4A3B7C]">{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(selectedIncomePoint || selectedExpensePoint) && (
                <>
                  <div className="flex items-center justify-between">
                    <p className={text.body}>{periodRangeLabel(selectedIncomePoint ?? selectedExpensePoint!)}</p>
                    <p
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: (selectedIncomePoint?.total ?? 0) - (selectedExpensePoint?.total ?? 0) < 0 ? "#D1517E" : "#2FAE82" }}
                    >
                      淨額 {formatCurrency((selectedIncomePoint?.total ?? 0) - (selectedExpensePoint?.total ?? 0))}
                    </p>
                  </div>
                  {selectedIncomePoint && selectedIncomePoint.byCategory.length > 0 && (
                    <div className="mt-3">
                      <p className={`mb-1.5 ${text.label}`}>收入 {formatCurrency(selectedIncomePoint.total)}</p>
                      <div className="flex flex-col divide-y divide-[#ECE4FA]">
                        {categoryRows(selectedIncomePoint).map((r) => (
                          <div key={r.id} className="flex items-center gap-3 py-2">
                            <IconAvatar icon={r.icon} size="sm" className={r.colorClass} />
                            <span className={`min-w-0 flex-1 truncate ${text.body}`}>{r.name}</span>
                            <span className="shrink-0 tabular-nums text-sm font-medium text-[#2FAE82]">{formatCurrency(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedExpensePoint && selectedExpensePoint.byCategory.length > 0 && (
                    <div className="mt-3">
                      <p className={`mb-1.5 ${text.label}`}>支出 {formatCurrency(selectedExpensePoint.total)}</p>
                      <div className="flex flex-col divide-y divide-[#ECE4FA]">
                        {categoryRows(selectedExpensePoint).map((r) => (
                          <div key={r.id} className="flex items-center gap-3 py-2">
                            <IconAvatar icon={r.icon} size="sm" className={r.colorClass} />
                            <span className={`min-w-0 flex-1 truncate ${text.body}`}>{r.name}</span>
                            <span className="shrink-0 tabular-nums text-sm font-medium text-[#D1517E]">{formatCurrency(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>
        </>
      )}
    </div>
  );
}
