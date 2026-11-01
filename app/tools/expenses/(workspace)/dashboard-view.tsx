"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MonthFilterPicker } from "@/components/expenses/date-filter-picker";
import { EmptyListCard, ListCard, ListRow } from "@/components/expenses/list-row";
import { Card, CardBody } from "@/components/expenses/card";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { PageHeader } from "@/components/expenses/page-header";
import { PetOsBubble } from "@/components/expenses/pet-os-bubble";
import { ExpandToggle, PREVIEW_COUNT } from "@/components/expenses/expand-toggle";
import { HiddenAmountsToggle, useHiddenAmounts } from "@/components/expenses/hidden-amounts";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { text } from "@/components/expenses/theme";
import { TOAST, useToast } from "@/components/expenses/toast";
import { dateFilterRange, defaultDateFilter, groupByDate, limitDateGroups, referenceYearMonth, shiftDays } from "@/lib/expenses/date-filter";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { categoryById, categoryColorClass, categoryFillClass, categoryPath, displayCategoryOf, topLevelCategories, type CategoryDTO } from "@/lib/expenses/categories";
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
import { petOsLines } from "@/lib/expenses/pet-os";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

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

// 首頁只做「摘要」，不是報表頁的另一份拷貝——這幾張卡片的清單固定只顯示前 5 筆，
// 分類一多也不會把首頁拉得又臭又長，完整清單一律用「查看完整報表」導去報表頁看。
const SUMMARY_LIMIT = PREVIEW_COUNT;

/** 首頁。資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，也不
 *  需要骨架。 */
export function DashboardView({
  initialCategories,
  initialTransactions,
  /** 這四份只用來算餘額、找帳戶名稱、算預算用掉多少，首頁不會改它們。 */
  accounts,
  accountTypes,
  transfers,
  budgetRules,
  osSeed,
}: {
  initialCategories: CategoryDTO[];
  initialTransactions: TransactionDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transfers: TransferDTO[];
  budgetRules: BudgetRuleDTO[];
  /** 主視覺對話框抽句子用的亂數種子，由 page.tsx 在伺服器產生（見 pet-os.ts）。 */
  osSeed: number;
}) {
  // 首頁的期間自己拿著，不接共用的 DateFilterContext——其他頁（報表、消費紀錄、帳戶
  // 明細）仍然共用一個篩選器，但首頁刻意獨立：它問的是「我這個月花得怎麼樣」，去報表頁
  // 翻到 2025/03 或切成「全部」之後回首頁，首頁該還是停在本月。而且永遠是「月」模式
  // （見 MonthFilterPicker），不會出現「全部期間」。
  const [filter, setFilter] = useState(defaultDateFilter);
  const showToast = useToast();
  // 新增交易的彈窗裡可以順手建一個新分類（onCategoriesChange），所以分類要是 state。
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const [transactions, setTransactions] = useState<TransactionDTO[]>(initialTransactions);
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

  async function handleCreateTransaction(draft: TransactionModalDraft) {
    const data: { transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.transactions) setTransactions(data.transactions);
    showToast(TOAST.created);
    setAddOpen(false);
  }

  const range = dateFilterRange(filter);

  const { totalIncome, totalExpense } = totalsForRange(transactions, categories, range);

  // ── 最近消費 ────────────────────────────────────────────────────────────────
  // 「近 7 天」是以「結束日之前最新的那一筆」為基準往回推，不是用今天往回推：翻到過去
  // 的月份時，用今天當基準這一區會整個空掉。
  //
  // 但起點**刻意不設限、允許跨月界**（只卡結束日，不卡這個月的第一天）。本來是先把資料
  // 切到選到的那個月再找最新的一筆，結果每個月的頭幾天只要還沒記帳，這一區就寫「還沒有
  // 任何資料」——明明前幾天才剛花過錢。對一個叫「最近消費」的區塊來說那是錯的：它問的
  // 是「我最近花了什麼」，不是「我這個月花了什麼」（後者是上面那張收支卡的事）。
  // 現在 11/2 還沒記帳時會顯示 10/27–10/31 那幾天，月份照樣跟著上面的篩選器走。
  const recentEnd = range?.end ?? todayISO;
  const expenseTx = transactions.filter((t) => t.date <= recentEnd && categoryById(categories, t.categoryId)?.kind === "支出");
  // 依日期分組（新的在上面），跟消費紀錄頁同一種版面。
  const sortedExpenses = [...expenseTx].sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentCutoff = sortedExpenses.length > 0 ? shiftDays(sortedExpenses[0].date, -6) : "";
  const recentGroups = groupByDate(sortedExpenses.filter((t) => t.date >= recentCutoff));
  const recentCount = recentGroups.reduce((sum, [, items]) => sum + items.length, 0);
  // 每一天的小計一律照「那一天全部的紀錄」算，不是照收合後看得到的那幾筆——被收起來的
  // 那天如果只剩兩筆，小計卻跟著縮水的話，展開前後同一天會出現兩個不同的金額。
  const recentDayTotals = new Map(recentGroups.map(([date, items]) => [date, items.reduce((sum, t) => sum + t.amount, 0)]));
  // 收起來時算的是「總共幾筆」，不是「幾天」——同一天可能有五六筆，照天數切的話收合後
  // 還是一長串。所以跨日期往下數到第 PREVIEW_COUNT 筆為止，那一天剩下的就一起收起來。
  const visibleRecentGroups = recentExpanded ? recentGroups : limitDateGroups(recentGroups, PREVIEW_COUNT);

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

  // 主視覺上只有日期（左上角）。首頁是「這個月的現況」，不是拿來做期間比較的地方——
  // 「跟誰比」那組設定收斂到報表頁，四個分頁共用一顆就夠了。
  // 角色的消費心理 OS：依近 7 日的收支狀況挑句子，每 5 秒淡出淡入換一句（見 pet-os.ts）。
  // 句子本身不帶數字——數字底下的卡片已經寫得很清楚了，上面這一句是要講出使用者心裡
  // 那句話。這一段不會因為上方的月份選擇而變：它看的永遠是「最近七天」，跟你正在翻
  // 哪一個月無關。
  const osLines = petOsLines(transactions, categories, budgetRules, todayISO, osSeed);

  // 主視覺上只剩對話框：水平置中、尾巴朝下，正好落在角色頭頂上方。日期搬進底下的
  // 白色面板了（見下面的 PageHeader），整片圖讓給角色。
  const heroOverlay = (
    <div className="absolute inset-x-5 top-5">
      <PetOsBubble lines={osLines} />
    </div>
  );

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
      <FloatingAddButton onClick={() => setAddOpen(true)} label="新增收支紀錄" />

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
      {/* 日期是「範圍控制項」——它宣告底下的數字是哪一段期間的，所以必須出現在它管的
          東西前面。它管的是這張收支卡**跟**底下的預算卡（兩邊共用 budgetYearMonth），
          所以不能塞進收支卡裡面：那樣看起來只管那一張，預算卡就不知道在講哪個月。

          排法跟報表／資產／明細三頁的 PageHeader 一致（標題左、日期右），切換頁面時
          日期永遠在同一個位置。首頁本來沒有標題，右對齊會讓這一列左半邊空一大片、
          膠囊像個漂浮的按鈕，補上「本月收支」正好把標題也一起補齊。

          這一列只放日期，不放那兩顆眼睛：眼睛遮的是各自那一欄的數字，跟期間不是同一
          種東西，混在一起會讓人以為眼睛是全域開關。 */}
      <PageHeader flush title="本月收支" actions={<MonthFilterPicker filter={filter} onChange={setFilter} />} />

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
                      <span className={`ml-1.5 ${text.muted}`}>未設定</span>
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
          //
          // 收合連結刻意放在 gap-5 那層的外面，跟上面「本月預算支出」一樣直接接在清單
          // 後面：擺進 gap-5 裡面的話它會同時吃到容器的 20px 間距跟自己的 mt-3，離清單
          // 比預算支出那顆遠一截，同一頁兩個一樣的連結卻有兩種間距。
          <>
            <div className="flex flex-col gap-5">
              {visibleRecentGroups.map(([date, items]) => (
                <div key={date}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                    <p className={`font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
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
            </div>
            {recentCount > PREVIEW_COUNT && (
              <ExpandToggle
                expanded={recentExpanded}
                total={recentCount}
                onToggle={() => setRecentExpanded((v) => !v)}
                label="顯示近七日"
              />
            )}
          </>
        )}
        </div>
      </div>
    </HeroShell>
  );
}
