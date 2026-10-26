"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { EmptyListCard, ListCard, ListRow } from "@/components/expenses/list-row";
import { Card, CardBody } from "@/components/expenses/card";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { HiddenAmountsToggle, useHiddenAmounts } from "@/components/expenses/hidden-amounts";
import { CardSkeleton, GroupedSectionSkeleton, SectionSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonShape, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text } from "@/components/expenses/theme";
import { dateFilterRange, referenceYearMonth } from "@/lib/expenses/date-filter";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { categoryColorClass, categoryFillClass, categoryPath, displayCategoryOf, topLevelCategories, type CategoryDTO } from "@/lib/expenses/categories";
import {
  totalsForRange,
  categoryBreakdown,
  incomeBreakdown,
  budgetSummary,
  transactionDisplayName,
  type TransactionDTO,
} from "@/lib/expenses/transactions";
// 帳戶／類型／轉帳這一頁自己不顯示（淨資產卡已經移到資產總表），但新增交易的彈窗要用。
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { monthDaysLeft, withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import { formatCurrency } from "@/lib/format";

/** 首頁的主視覺＋底下那張蓋上來的白色內容面板，比照搭乘車首頁的版型
 *  （app/tools/transit/home-view.tsx）。
 *
 *  外層的負邊距是為了掙脫外殼給每一頁的留白（ExpensesMobileShell 的 px-5 pt-6 pb-6）——
 *  主視覺要滿版出血，不能縮在左右各 20px 的內容欄裡。白色面板的 -mt-16 讓它往上蓋住
 *  主視覺的下緣，圓角才會壓在圖片上；pb 留到導覽列以下，不然捲到底會露出外殼的紫色漸層。 */
function HeroShell({ children, overlay }: { children: ReactNode; overlay: ReactNode }) {
  return (
    <div className="-mx-5 -mb-24 -mt-6 flex flex-1 flex-col">
      <div className="relative h-80 w-full shrink-0 overflow-hidden bg-[#EDE6FB]">
        {/* 固定一張本地插畫、尺寸也固定，不需要 next/image 的動態最佳化（搭乘車的
            ImageSlot 同樣是直接用 <img>）。底色先鋪著，圖還沒載完時不會是一片白。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/expenses/main-work.png" alt="記帳插畫" className="h-full w-full object-cover" />
        {/* 選日期跟比較基準疊在圖上（絕對定位），不佔內容面板的高度——這兩個控制項一年
            到頭都在那裡，擺進白色面板裡等於每次進首頁都先看到兩列控制項才看到數字。 */}
        {overlay}
      </div>
      <div className="relative z-10 -mt-16 flex-1 rounded-t-[2rem] bg-white px-5 pb-28 pt-5 shadow-[0_-8px_24px_-8px_rgba(111,95,214,0.2)]">
        {children}
      </div>
    </div>
  );
}

/** 依日期分組的清單，跨組往下數到第 limit 筆為止（數滿了的那一組只留前面幾筆，
 *  後面的組整組捨去）。給「最近消費」收合用。 */
function limitEntries<T>(groups: [string, T[]][], limit: number): [string, T[]][] {
  const out: [string, T[]][] = [];
  let left = limit;
  for (const [date, items] of groups) {
    if (left <= 0) break;
    out.push([date, items.slice(0, left)]);
    left -= items.length;
  }
  return out;
}

/** 把 `YYYY-MM-DD` 往前／往後推幾天。用本地時區的 Date 做日曆運算，不碰 UTC。 */
function shiftDays(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + delta);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = PREVIEW_COUNT;

export function DashboardView() {
  const { filter } = useDateFilter();
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // 兩張長清單各自的「展開／收合」，預設都是收起來的（見 ExpandToggle）。
  const [expenseRowsExpanded, setExpenseRowsExpanded] = useState(false);
  const [incomeRowsExpanded, setIncomeRowsExpanded] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  // 在外面看記帳本時把金額遮起來，記在這台裝置上（見 hidden-amounts.tsx）。
  // 收入跟支出各一顆眼睛、各自記各自的狀態：只想遮薪水、不在意別人看到今天花了多少，
  // 這種情況比「全部一起遮」常見。收入來源那一區的金額跟著收入那顆走、預算支出跟著
  // 支出那顆走——它們本來就是同一個數字的明細，分開遮會自相矛盾。
  const income = useHiddenAmounts("income");
  const expense = useHiddenAmounts("expense");
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

  const { totalIncome, totalExpense, expenseTx } = totalsForRange(transactions, categories, range);
  // 「最近消費」只看近 7 天，而且是以「這段期間裡最新的一筆」為基準往回推——用今天當
  // 基準的話，翻到過去的月份時這一區會整個空掉。依日期分組（新的在上面），跟消費紀錄
  // 頁同一種版面。
  const sortedExpenses = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentCutoff = sortedExpenses.length > 0 ? shiftDays(sortedExpenses[0].date, -6) : "";
  const recentGroups = [...
    sortedExpenses
      .filter((t) => t.date >= recentCutoff)
      .reduce((map, t) => map.set(t.date, [...(map.get(t.date) ?? []), t]), new Map<string, TransactionDTO[]>())
  ];
  const recentCount = recentGroups.reduce((sum, [, items]) => sum + items.length, 0);
  // 每一天的小計一律照「那一天全部的紀錄」算，不是照收合後看得到的那幾筆——被收起來的
  // 那天如果只剩兩筆，小計卻跟著縮水的話，展開前後同一天會出現兩個不同的金額。
  const recentDayTotals = new Map(recentGroups.map(([date, items]) => [date, items.reduce((sum, t) => sum + t.amount, 0)]));
  // 收起來時算的是「總共幾筆」，不是「幾天」——同一天可能有五六筆，照天數切的話收合後
  // 還是一長串。所以跨日期往下數到第 PREVIEW_COUNT 筆為止，那一天剩下的就一起收起來。
  const visibleRecentGroups = recentExpanded ? recentGroups : limitEntries(recentGroups, PREVIEW_COUNT);

  // 預算本來就是以「月」為單位，所以不直接吃篩選器的區間（可能是一天、一年或自訂區間），
  // 而是取篩選器的參考月份：篩到 2026-08 就看 8 月的預算，切回本月就看本月。這樣卡片標題、
  // 卡片數字、跟點「查看全部」進去看到的明細講的都是同一個月，不會首頁說本月、點進去卻是
  // 篩選器停留的另一個月。
  const budgetYearMonth = referenceYearMonth(filter);
  const [budgetYear, budgetMonth] = budgetYearMonth.split("-").map(Number);
  const budgetMonthRange = dateFilterRange({ ...filter, mode: "month", year: budgetYear, month: budgetMonth });
  const { expenseTx: budgetMonthExpenseTx, incomeTx: budgetMonthIncomeTx } = totalsForRange(transactions, categories, budgetMonthRange);
  const budget = budgetSummary(budgetMonthExpenseTx, categories, withLegacyCategoryBudgets(budgetRules, categories), budgetYearMonth);
  const budgetDaysLeft = monthDaysLeft(budgetYearMonth, todayISO);

  // 首頁的支出清單把「有編預算」跟「沒編預算」的分類列在一起（跟預算設定頁同一種列法），
  // 所以不需要再另外放一個「消費分類佔比」區塊——那塊列的分類這裡全都有，而且還多了
  // 預算狀態。沒編預算的分類只顯示花了多少，不畫進度條（沒有分母可以畫）。
  const budgetedById = new Map(budget.rows.map((r) => [r.category.id, r]));
  const spentById = new Map(categoryBreakdown(budgetMonthExpenseTx, categories).map((r) => [r.category.id, r.amount]));
  const expenseRows = topLevelCategories(categories, "支出")
    .map((category) => ({ category, spent: spentById.get(category.id) ?? 0, budget: budgetedById.get(category.id) ?? null }))
    .filter((row) => row.spent > 0 || row.budget !== null)
    .sort((a, b) => b.spent - a.spent);

  // 收入來源：跟底下的預算卡同一個月份（budgetMonthRange），不是吃篩選器的任意區間——
  // 兩塊疊在一起，月份不一樣的話數字對不起來。
  const incomeRows = incomeBreakdown(budgetMonthIncomeTx, categories);

  // 帶上月份，點進去的紀錄頁會把共用篩選器切到同一個月，數字才對得起來。
  const budgetDetailQuery = `kind=支出&month=${budgetYearMonth}`;
  const incomeDetailQuery = `kind=收入&month=${budgetYearMonth}`;

  // 載入中畫骨架。三塊清單各記各的筆數——它們長度本來就不一樣（收入來源通常一兩列、
  // 預算支出五六列），共用一個數字的話一定有兩塊對不上，資料回來時版面就會跳。
  const incomeSkeletonCount = useSkeletonCount(
    "cpx-tools:expenses-skeleton:dashboard-income",
    2,
    ready ? Math.min(incomeRows.length, SUMMARY_LIMIT) : undefined,
  );
  const budgetSkeletonCount = useSkeletonCount(
    "cpx-tools:expenses-skeleton:dashboard-budget",
    SUMMARY_LIMIT,
    ready ? Math.min(expenseRows.length, SUMMARY_LIMIT) : undefined,
  );
  // 最近消費是「日期小標＋那天的卡片」一組一組排的，只記總筆數還原不出組數，所以記的是
  // 形狀（每一組各幾列）。
  const recentSkeletonShape = useSkeletonShape(
    "cpx-tools:expenses-skeleton:dashboard-recent",
    [3, 2],
    ready ? visibleRecentGroups.map(([, items]) => items.length) : undefined,
  );

  // 主視覺上只有日期（左上角）。首頁是「這個月的現況」，不是拿來做期間比較的地方——
  // 「跟誰比」那組設定收斂到報表頁，四個分頁共用一顆就夠了。
  const heroOverlay = (
    <div className="absolute inset-x-5 top-5 flex items-start">
      <DateFilterPicker compact />
    </div>
  );

  // 骨架等掛載後才畫：列數只有瀏覽器讀得到，伺服器端畫出來的一定是預設值，
  // 不擋的話會先閃一次錯的列數再換成記住的（見 useSkeletonReady）。
  if (!skeletonReady) return null;

  if (!ready) {
    // 骨架照著載入完成後的版面排——連外層的 gap 都要一樣（下面是 gap-5），不然資料
    // 回來時每一塊的間距都會變一次。三塊清單的列數各自來自上次記住的實際筆數。
    return (
      <HeroShell overlay={heroOverlay}>
        <div className="flex flex-col gap-5">
          {/* 收入／支出同一張卡分兩欄，每一欄是「小標一行、金額＋眼睛一行」——跟下面
              載入完成後那張卡（含 p-3、gap-3、中間那條分隔線、金額列的 min-h-8）
              對齊，資料回來時高度不會跳。 */}
          <CardSkeleton className="[&>div]:p-3">
            <div className="grid grid-cols-2 gap-3">
              {[false, true].map((divider, i) => (
                <div key={i} className={divider ? "border-l border-[#F2EEFA] pl-3" : undefined}>
                  <SkeletonBar width={32} height={12} />
                  <div className="mt-0.5 flex min-h-8 items-center justify-between gap-1">
                    <SkeletonBar width={96} height={18} />
                    {/* 眼睛按鈕是 size-8 的圓，骨架也要佔掉同樣的位置。 */}
                    <div className="size-8 shrink-0 animate-pulse rounded-full bg-[#EDE6FB]" />
                  </div>
                </div>
              ))}
            </div>
          </CardSkeleton>
          <SectionSkeleton count={incomeSkeletonCount} progress />
          <SectionSkeleton count={budgetSkeletonCount} progress />
          <GroupedSectionSkeleton shape={recentSkeletonShape} />
        </div>
      </HeroShell>
    );
  }

  return (
    <HeroShell overlay={heroOverlay}>
      <div className="flex flex-col gap-5">

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

      {/* 結餘、收入、支出三個數字合併成一張卡，不是三張（原本是一張整寬的結餘＋一個
          兩欄輪播）：三者本來就是同一道算式的三個部分（收入－支出＝結餘），拆成三張卡
          等於多兩組卡片留白跟兩道間距，在手機上光這一區就吃掉半個畫面，下面的預算跟
          最近消費全被擠出第一屏。

          版面是「結論在上、組成在下」：結餘用大字獨佔一行，收入／支出在同一張卡裡分成
          左右兩半，中間一條分隔線。兩半各自可以點，帶同一個月份進到消費紀錄的對應分頁。

          固定收支跟淨資產兩張卡移除：固定收支已經自動入帳、金額本來就含在收入／支出裡，
          單獨再列一個數字只會讓人以為是另外一筆；淨資產是「現在總共有多少」，跟這一頁
          「這個月進出多少」不是同一種數字，在資產總表（有月份、有各類型佔比）看才完整。 */}
      {/* 同一張卡分兩欄：左邊收入、右邊支出，中間一條細線分開。
          原本最上面那一行大字的「結餘」移除了：它是「收入減支出」，兩個加數就在同一張卡
          上，看得到就算得出來；而且它獨佔一行大字，是這一區最佔版面的東西，拿掉之後預算
          支出跟最近消費才回得到第一屏。數字本身沒有消失，報表頁的「淨額」分頁就是結餘。

          眼睛各一顆、就放在金額右邊，兩邊各自記各自的狀態。金額那一行用 min-h 卡住高度：
          遮起來時星號的字級比數字小，沒卡住的話按一下卡片會抽動一下。 */}
      <Card>
        <CardBody className="grid grid-cols-2 gap-3 p-3">
          {[
            { label: "收入", total: totalIncome, state: income, divider: false },
            { label: "支出", total: totalExpense, state: expense, divider: true },
          ].map(({ label, total, state, divider }) => (
            <div key={label} className={divider ? "border-l border-[#F2EEFA] pl-3" : undefined}>
              <p className={text.muted}>{label}</p>
              <div className="mt-0.5 flex min-h-8 items-center justify-between gap-1">
                {/* 數字本身可以點，帶同一個月份進到消費紀錄的對應分頁；眼睛是另一顆按鈕，
                    不能包在連結裡（HTML 不允許 a 裡面再放互動元素）。 */}
                <Link
                  href={`/tools/expenses/transactions?kind=${label}&month=${budgetYearMonth}`}
                  className="min-w-0 truncate text-lg font-bold tabular-nums text-[#4A3B7C]"
                >
                  {state.mask(formatCurrency(total))}
                </Link>
                <HiddenAmountsToggle hidden={state.hidden} onToggle={state.toggle} />
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* 收入來源擺在支出上方：先知道「這個月進來多少、從哪來」，再往下看花到哪去。
          每一列都可以點，帶著同一個月份導到消費紀錄的收入分頁並篩好那個分類——
          收入這邊本來沒有任何入口可以點進明細。 */}
      <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className={text.sectionHeading}>收入來源</p>
            <Link href={`/tools/expenses/transactions?${incomeDetailQuery}`} className="text-xs font-medium text-[#6F5FD6]">
              查看全部
            </Link>
          </div>
          {incomeRows.length === 0 ? (
            <EmptyListCard />
          ) : (
          <ListCard>
            {(incomeRowsExpanded ? incomeRows : incomeRows.slice(0, SUMMARY_LIMIT)).map((row) => (
              <Link
                key={row.id}
                href={`/tools/expenses/transactions?${incomeDetailQuery}&categoryId=${row.id}`}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <ListProgressRow
                  icon={row.icon}
                  iconClassName={categoryColorClass[row.color]}
                  name={row.name}
                  amount={income.mask(formatCurrency(row.amount))}
                  pct={row.pct}
                  barColorClass={categoryFillClass[row.color]}
                />
              </Link>
            ))}
          </ListCard>
          )}
          {incomeRows.length > SUMMARY_LIMIT && (
            <ExpandToggle expanded={incomeRowsExpanded} total={incomeRows.length} onToggle={() => setIncomeRowsExpanded((v) => !v)} />
          )}
      </div>

      {/* 小標在白框外面、清單在框裡——跟資產總表的「資產」區塊同一種結構。 */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>預算支出</p>
          <Link href={`/tools/expenses/transactions?${budgetDetailQuery}`} className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {expenseRows.length === 0 ? (
          <EmptyListCard />
        ) : (
          <ListCard>
            <div className="px-4 py-3.5">
              {/* items-center：金額、剩餘天數、百分比三個字級不一樣（lg／11px／xs），
                  靠底部對齊的話小字會沉下去，看起來沒對齊。 */}
              <div className="flex items-center justify-between gap-2">
                <p className={text.statValue}>
                  {expense.hidden ? (
                    expense.mask("")
                  ) : (
                    <>
                      {formatCurrency(budget.totalSpent)}
                      <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(budget.totalBudget)}</span>
                    </>
                  )}
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
            </div>
            {/* 每一列都可以點，直接跳到紀錄頁、而且已經幫你篩好那個分類的明細。
                有編預算的畫「花了多少／預算多少」的進度條，沒編預算的只報金額——沒有
                分母就沒有進度可言，硬畫一條空的反而像是用了 0%。 */}
            {(expenseRowsExpanded ? expenseRows : expenseRows.slice(0, SUMMARY_LIMIT)).map((row) =>
              row.budget ? (
                <Link
                  key={row.category.id}
                  href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <ListProgressRow
                    icon={row.category.icon}
                    iconClassName={categoryColorClass[row.category.color]}
                    name={row.category.name}
                    amount={expense.mask(`${formatCurrency(row.budget.spent)} / ${formatCurrency(row.budget.budgetAmount)}`)}
                    pct={row.budget.pct}
                    pctLabel={<span className={row.budget.pct > 100 ? "text-[#D1517E]" : undefined}>{row.budget.pct}%</span>}
                    barColorClass={row.budget.pct > 100 ? "bg-[#D1517E]" : categoryFillClass[row.category.color]}
                  />
                </Link>
              ) : (
                <ListRow
                  key={row.category.id}
                  href={`/tools/expenses/transactions?${budgetDetailQuery}&categoryId=${row.category.id}`}
                  icon={row.category.icon}
                  iconClassName={categoryColorClass[row.category.color]}
                  name={row.category.name}
                  right={
                    <span className="text-sm">
                      <span className="tabular-nums font-semibold text-[#4A3B7C]">{expense.mask(formatCurrency(row.spent))}</span>
                      <span className={`ml-1.5 ${text.muted}`}>未編預算</span>
                    </span>
                  }
                />
              ),
            )}
          </ListCard>
        )}
        {expenseRows.length > SUMMARY_LIMIT && (
          <ExpandToggle
            expanded={expenseRowsExpanded}
            total={expenseRows.length}
            onToggle={() => setExpenseRowsExpanded((v) => !v)}
          />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className={text.sectionHeading}>最近消費</p>
          <Link href="/tools/expenses/transactions" className="text-xs font-medium text-[#6F5FD6]">
            查看全部
          </Link>
        </div>
        {recentGroups.length === 0 ? (
          <EmptyListCard />
        ) : (
          // 版面跟「查看全部」進去的消費紀錄頁一樣：日期當小標、右邊掛當天小計，底下才是
          // 那一天的明細（標題是備註/分類、副標是分類路徑）。
          <div className="flex flex-col gap-5">
            {visibleRecentGroups.map(([date, items]) => (
              <div key={date}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                  <p className={`font-medium ${text.muted}`}>{date}</p>
                  <p className={`font-medium tabular-nums ${text.muted}`}>
                    {expense.hidden ? expense.mask("") : `－${formatCurrency(recentDayTotals.get(date) ?? 0)}`}
                  </p>
                </div>
                <ListCard>
                  {items.map((t) => {
                    // 子分類沿用大分類的圖示與顏色：「下午茶」顯示的是「餐飲」那顆。
                    const cat = displayCategoryOf(categories, t.categoryId);
                    return (
                      // 整列都可以點，跟右上角的「查看全部」去同一頁。
                      <Link key={t.id} href="/tools/expenses/transactions" className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <TransactionRowLabel
                          icon={cat?.icon ?? "🏷️"}
                          iconClassName={cat ? categoryColorClass[cat.color] : undefined}
                          title={transactionDisplayName(t, categories)}
                          subtitle={categoryPath(categories, t.categoryId)}
                        />
                        <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">
                          {expense.hidden ? expense.mask("") : `－${formatCurrency(t.amount)}`}
                        </span>
                      </Link>
                    );
                  })}
                </ListCard>
              </div>
            ))}
            {recentCount > PREVIEW_COUNT && (
              <ExpandToggle
                expanded={recentExpanded}
                total={recentCount}
                onToggle={() => setRecentExpanded((v) => !v)}
                label="顯示近七日"
              />
            )}
          </div>
        )}
        </div>
      </div>
    </HeroShell>
  );
}
