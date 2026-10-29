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
import { ComparePicker } from "@/components/expenses/compare-picker";
import { text } from "@/components/expenses/theme";
import { DonutChart, type DonutSlice } from "@/components/expenses/donut-chart";
import { TrendBarChart, NetTrendChart, AssetTrendChart, type TrendSeries } from "@/components/expenses/trend-bar-chart";
import { KpiCard, DeltaText, KPI_NEGATIVE, KPI_POSITIVE } from "@/components/expenses/kpi-card";
import { accountBalance, accountsByKind, balanceDelta, netWorth, netWorthAt, sumByAccountType, totalByKind, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, accountTypeColorClass, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
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
import { compareDateFilter, compareLabel, dateFilterRange } from "@/lib/expenses/date-filter";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { DonutCardSkeleton, KpiCardSkeleton, SummaryCardSkeleton, TrendCardSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonShape, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { formatCurrency } from "@/lib/format";

type ReportKind = "支出" | "收入" | "淨額" | "資產";

/** 淨額那一頁「收入／支出」兩塊的顏色——借分類色票的 a（淡紫）跟 c（粉），跟首頁
 *  「薪水」「利息」那兩個預設分類是同一個色號，整個 App 的收支配色才是同一套。 */
const NET_INCOME_COLOR = categoryColorHex.a;
const NET_EXPENSE_COLOR = categoryColorHex.c;

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
  const { filter, compare } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const skeletonReady = useSkeletonReady();
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
  // 一次，就是那一天當時的數字（見 lib/expenses/accounts.ts 的 netWorthAt）。
  const assetAccounts = accountsByKind(accounts, accountTypes, "asset");
  // 「這段期間的最後一天」就是資產的基準日；選「全部」沒有結束日，那就是今天。
  const assetAsOf = dateFilterRange(filter)?.end ?? todayISO;
  const assetTx = transactions.filter((t) => t.date <= assetAsOf);
  const assetTransfers = transfers.filter((t) => t.date <= assetAsOf);
  const net = netWorth(accounts, accountTypes, assetTx, categories, assetTransfers);
  const totalAssets = totalByKind(accounts, accountTypes, assetTx, categories, assetTransfers, "asset");
  const totalLiabilities = totalByKind(accounts, accountTypes, assetTx, categories, assetTransfers, "liability");

  // 比較基準跟收支分頁走同一個設定（上一期／去年同期／指定年份）：把現在看的這段期間
  // 整個平移過去，取平移後那一期的最後一天當時的數字。
  const compareDate = dateFilterRange(compareDateFilter(filter, compare) ?? filter)?.end ?? null;
  const compareTx = compareDate ? transactions.filter((t) => t.date <= compareDate) : [];
  const compareTransfers = compareDate ? transfers.filter((t) => t.date <= compareDate) : [];
  const hasAssetBaseline = compareDate !== null && compareDateFilter(filter, compare) !== null;
  const netDelta = hasAssetBaseline ? balanceDelta(net, netWorth(accounts, accountTypes, compareTx, categories, compareTransfers)) : null;
  const assetsDelta = hasAssetBaseline
    ? balanceDelta(totalAssets, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "asset"))
    : null;
  const liabilitiesDelta = hasAssetBaseline
    ? balanceDelta(totalLiabilities, totalByKind(accounts, accountTypes, compareTx, categories, compareTransfers, "liability"))
    : null;

  const assetTypeTotals = sumByAccountType(assetAccounts, accountTypes, assetTx, categories, assetTransfers);
  const assetTypeSum = [...assetTypeTotals.values()].reduce((sum, v) => sum + v, 0) || 1;
  const assetTypeBreakdown = [...assetTypeTotals.entries()]
    .map(([typeId, amount]) => {
      const type = accountTypeById(accountTypes, typeId);
      return {
      id: typeId,
      name: type?.name ?? "（未知類型）",
      amount,
      pct: (amount / assetTypeSum) * 100,
      // 用這個帳戶類型自己設定的顏色（設定 › 帳戶類型那一頁選的），不是照順序循環配色：
      // 循環配色的話同一個類型在資產頁是紫色、在這張圖卻是黃色，而且新增／刪掉一個類型
      // 會讓剩下每一個的顏色整排位移。找不到類型（被刪掉了）才退回灰色。
      colorHex: type ? categoryColorHex[type.color] : OTHER_COLOR,
      };
    })
    .sort((a, b) => b.amount - a.amount);
  const assetTypeDonutData: DonutSlice[] = assetTypeBreakdown.map((r) => ({ id: r.id, label: r.name, amount: r.amount, colorHex: r.colorHex }));
  const assetTypeColor = new Map(assetTypeBreakdown.map((r) => [r.id, r.colorHex]));

  // 圓餅是按「類型」分，下面這份清單是按「帳戶」列——跟支出分頁「圓餅看大分類、清單看
  // 細項」同一個層次關係。顏色沿用該帳戶所屬類型在圓餅上的顏色，兩邊對得起來。
  const assetAccountRows = assetAccounts
    .map((a) => {
      const balance = accountBalance(a, accountTypes, assetTx, categories, assetTransfers);
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
  // 徽章後綴要照使用者選的比較基準講，不是照期間單位講：選了「去年同期」卻寫「vs 上期」
  // 的話，數字其實是跟去年比、字卻說是跟上一期比，兩邊對不起來。帳戶明細頁本來就是用
  // compareLabel，這裡之前漏掉了。
  const deltaSuffix = compareLabel(filter, compare);
  const hasPriorData = (r: ReturnType<typeof dateFilterRange>) => transactionsInDateRange(transactions, r).length > 0;

  const { totalIncome, totalExpense, balance, expenseTx, incomeTx } = totalsForRange(transactions, categories, range);
  const summaryTotal = kind === "支出" ? totalExpense : kind === "收入" ? totalIncome : balance;
  // 第四個參數一定要傳：不傳的話 rangeDelta 會沿用舊行為「一律比上一期」，等於使用者
  // 選的比較基準完全沒作用——選「不比較」照樣冒出漲跌徽章、選「去年同期」算出來的卻是
  // 跟上個月比的數字。資產分頁本來就是走 compareDateFilter，收支這三個分頁之前漏掉了。
  const summaryDelta = rangeDelta(
    (r) => {
      const t = totalsForRange(transactions, categories, r);
      return kind === "支出" ? t.totalExpense : kind === "收入" ? t.totalIncome : t.balance;
    },
    filter,
    hasPriorData,
    compareDateFilter(filter, compare),
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

  // 淨額沒有「分類佔比」可以畫——它是收入減支出的差，不是一堆分類加起來。能畫的是
  // 「這段期間的錢從哪裡來、又去了哪裡」：收入跟支出兩片，中間的缺口就是結餘。版面
  // 跟支出／收入分頁的圓餅完全一樣，四個分頁看起來才是同一種東西。
  const netDonutData: DonutSlice[] = [
    // 收支兩塊用分類色票的紫跟粉（NET_INCOME_COLOR／NET_EXPENSE_COLOR），不是 KPI 的
    // 綠／紅：綠紅在這個 App 裡講的是「變好／變壞」（漲跌徽章、結餘正負），但圓餅這兩塊
    // 只是「這段期間進來多少、出去多少」的組成，沒有好壞可言，借用綠紅會讓人以為支出
    // 那塊本身是個警訊。底下的「結餘」那一行才是真的有好壞，所以仍然維持綠／紅。
    { id: "income", label: "收入", amount: totalIncome, colorHex: NET_INCOME_COLOR },
    { id: "expense", label: "支出", amount: totalExpense, colorHex: NET_EXPENSE_COLOR },
  ].filter((d) => d.amount > 0);
  const netDonutTotal = totalIncome + totalExpense;

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

  // 載入中畫骨架，「明細」那張卡的形狀用上次記住的實際數量（見 skeleton-count.ts）。
  //
  // 記的是 [圖例幾列, 底下清單幾列] 兩個數字，不是單一個列數：這兩段的數量本來就不一樣
  // （圖例只列前 TOP_N 名、清單是每個分類／帳戶一列），資產分頁更是兩件不同的東西
  // （有幾種資產類型 vs 有幾個資產帳戶）。而且四個分頁的內容差很多，各記各的——用同一把
  // 鑰匙的話，看完支出（六列）切到收入（一列）就會先閃六列骨架。
  const detailShapeKey = `cpx-tools:expenses-skeleton:reports:${kind}`;
  const actualDetailShape = !ready
    ? undefined
    : kind === "資產"
      ? [assetTypeBreakdown.length, assetAccountRows.length]
      : kind === "淨額"
        ? // 淨額的明細卡在沒有收支資料時整張不出現，所以第二個數字當成「這張卡在不在」。
          [netDonutData.length, netDonutData.length > 0 ? 1 : 0]
        : [Math.min(donutData.length, TOP_N), Math.min(breakdown.length, TOP_N)];
  const detailShape = useSkeletonShape(
    detailShapeKey,
    kind === "資產" ? [3, 3] : kind === "淨額" ? [2, 1] : [TOP_N, TOP_N],
    actualDetailShape,
  );
  const [legendSkeletonRows = 0, listSkeletonRows = 0] = detailShape;

  const selectedIncomePoint = kind === "淨額" ? (incomeTrendPoints.find((p) => p.start === selectedTrendStart) ?? null) : null;
  const selectedExpensePoint = kind === "淨額" ? (expenseTrendPoints.find((p) => p.start === selectedTrendStart) ?? null) : null;

  // 骨架等掛載後才畫：列數只有瀏覽器讀得到，伺服器端畫出來的一定是預設值，
  // 不擋的話會先閃一次錯的列數再換成記住的（見 useSkeletonReady）。
  if (!skeletonReady) return null;

  if (!ready) {
    // 骨架照著載入完成後的版面排：分頁切換、日期篩選器、期間總額、明細（圓餅＋清單）、
    // 趨勢。前兩排是固定的控制項，直接畫出它們的形狀，資料回來時只有數字長出來。
    return (
      <div className="flex flex-col gap-4">
        {/* 標題列右邊掛日期膠囊＋日曆圖示，下一列是「vs 上期」，再往下才是四個分頁
            。順序跟真畫面一致，不然資料回來那一刻幾排會對調；寬高也要跟真的一樣
            （分頁現在是跟著文字走的內容寬度，不是撐滿整列），不然底下整塊會跳一下。 */}
        <PageHeader
          title="報表"
          flush
          actions={
            <div className="flex items-center gap-2">
              <div className="h-[34px] w-[116px] animate-pulse rounded-full bg-[#EDE6FB]" />
              <div className="size-[32px] animate-pulse rounded-full bg-[#EDE6FB]" />
            </div>
          }
        />
        <div className="flex items-center justify-between gap-2">
          <div className="h-9 w-[224px] animate-pulse rounded-full bg-[#EDE6FB]" />
          <div className="h-9 w-[96px] animate-pulse rounded-full bg-[#EDE6FB]" />
        </div>
        {kind === "資產" ? (
          // 淨資產一張、資產／負債兩張並排——間距是 gap-3 包在一起的，跟外層的 gap-4
          // 不一樣，分開放會多撐出 4px。
          <div className="flex flex-col gap-3">
            <KpiCardSkeleton />
            <div className="grid grid-cols-2 gap-3">
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </div>
          </div>
        ) : (
          <SummaryCardSkeleton delta />
        )}
        {kind === "淨額" ? (
          // 沒有收支資料時整張明細卡不出現，骨架也不畫（見 actualDetailShape 的說明）。
          listSkeletonRows > 0 && <DonutCardSkeleton legendRows={legendSkeletonRows} variant="line" />
        ) : (
          <DonutCardSkeleton legendRows={legendSkeletonRows} listRows={listSkeletonRows} />
        )}
        <TrendCardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 期間跟「報表」標題同一列、靠右：它是整頁的前提（這一頁所有數字都是算這一段裡
          的），放在最上面跟標題平起，往下才是「這一段要看哪一面」的四個分頁。日期膠囊
          跟日曆圖示是同一個右側區塊（見 date-filter-picker.tsx）。
          資產分頁看的是「某一天當時有多少」而不是「一段期間內發生多少」，所以它對這段
          期間的解讀是「最後一天當時有多少」——切到 2026-09 就看九月底的淨資產，這樣才
          看得出每個月的成長或衰退。 */}
      <PageHeader title="報表" flush actions={<DateFilterPicker />} />

      {/* 分頁靠左、「跟誰比」靠右，同一列——跟上面「報表＋日期」那一列同一個分法，
          兩列的右邊界也對齊。「跟誰比」四個分頁共用一個設定（本來只有資產分頁裡面有
          一顆自己的基準日選擇器，切到別的分頁就不見了）。 */}
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          value={kind}
          onChange={(v) => {
            setKind(v);
            setExpanded(false);
            setSelectedTrendStart(null);
          }}
          // self-start：這一組是 inline-flex（寬度跟著文字走，跟消費紀錄頁的支出／收入
          // 同一種），但 flex 容器預設 align-items: stretch 會把它拉成滿版，看起來像還
          // 留著 fullWidth。
          className="self-start"
          activeTone="solid"
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
            { value: "淨額", label: "淨額" },
            { value: "資產", label: "資產" },
          ]}
        />
        <ComparePicker />
      </div>

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
          <p className={text.muted}>{kind === "淨額" ? "結餘" : kind}</p>
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-2xl font-bold tabular-nums text-[#4A3B7C]">
              {summaryTotal < 0 ? "－" : ""}
              {formatCurrency(Math.abs(summaryTotal))}
            </p>
            {summaryDelta && <DeltaBadge delta={summaryDelta.delta} pct={summaryDelta.pct} goodWhenUp={kind !== "支出"} suffix={deltaSuffix} />}
          </div>
        </CardBody>
      </Card>

      {kind === "淨額" && netDonutData.length > 0 && (
        <Card>
          <CardBody>
            <p className={text.sectionHeading}>明細</p>
            <div className="mt-4 flex items-center gap-5">
              <DonutChart data={netDonutData} size={120} />
              <div className="flex flex-1 flex-col gap-2">
                {netDonutData.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-[#4A3B7C]">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.colorHex }} />
                      {d.label}
                    </span>
                    <span className={`tabular-nums ${text.muted}`}>{((d.amount / netDonutTotal) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 圓餅只看得出收支的比例，底下補一行把「所以結餘是多少」講完。 */}
            <div className="mt-5 flex items-center justify-between border-t border-[#F2EEFA] pt-4 text-sm">
              <span className={text.body}>結餘</span>
              <span className="tabular-nums font-semibold" style={{ color: balance < 0 ? KPI_NEGATIVE : KPI_POSITIVE }}>
                {balance < 0 ? "－" : ""}
                {formatCurrency(Math.abs(balance))}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {kind !== "淨額" && (
        <Card>
          <CardBody>
            <p className={text.sectionHeading}>分類佔比</p>
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
                          // 18 + 2（豎線）+ 32 ＝ 52px，剛好等於主分類那一列「圖示 40 ＋
                          // gap-3 的 12」，子分類的名稱才跟主分類的名稱對齊，而不是對齊圖示。
                          <div className="ml-[18px] mt-2 flex flex-col gap-2 border-l-2 border-[#ECE4FA] pl-8">
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
