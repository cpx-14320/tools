"use client";

import { useState } from "react";
import { TOAST, useToast } from "@/components/expenses/toast";
import { PageHeader } from "@/components/expenses/page-header";
import { ListRow } from "@/components/expenses/list-row";
import { BudgetModal } from "@/components/expenses/budget-modal";
import { BudgetBatchModal, type BudgetBatchItem } from "@/components/expenses/budget-batch-modal";
import { StickyToolbar } from "@/components/expenses/sticky-toolbar";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { useBusy } from "@/components/expenses/busy";
import { text } from "@/components/expenses/theme";
import { budgetForMonth, isLegacyRule, rulesForCategory, withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import { topLevelCategories, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency, formatYearMonth } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 要開哪一個分類的預算彈窗，以及要編的是哪一筆（rule 為 undefined＝新增一筆）。 */
type EditTarget = { category: CategoryDTO; rule?: BudgetRuleDTO };

/** 預算設定頁——列出所有支出分類，每個分類底下直接攤開它設過的幾筆「從某月起多少」。
 *
 *  版面刻意跟「收支分類」那一頁長一樣：主分類一列，它的細項列在同一張卡底下的淡色
 *  區塊裡。那一頁的細項是子分類，這一頁的細項是生效月份，但「點主分類列＝新增一筆、
 *  點細項＝編輯那一筆」的操作是同一套。
 *
 *  頁面最上面不再有全域的月份選擇器跟總預算卡：預算是一個分類一個分類決定的，全域
 *  月份會讓人以為那是「在看哪個月的預算」，其實它是「這次要從哪個月開始改」——那個
 *  選擇現在搬進各別分類的編輯彈窗裡（見 BudgetModal）。想看「這個月總共編了多少、
 *  花到哪」請看首頁的本月預算支出跟報表頁。 */
export function BudgetsView({ initialCategories, initialRules }: { initialCategories: CategoryDTO[]; initialRules: BudgetRuleDTO[] }) {
  // 資料是 page.tsx 在伺服器上讀好傳進來的，所以這一頁沒有「載入中」這個狀態，也就
  // 不需要骨架：第一次畫出來就是有資料的畫面。之後的新增／刪除還是打 API，拿回傳的
  // 完整清單覆蓋這裡的 state（不用 router.refresh()，少一趟來回）。
  const categories = initialCategories;
  const showToast = useToast();
  const runBusy = useBusy();
  const [rules, setRules] = useState<BudgetRuleDTO[]>(initialRules);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  async function handleSave(yearMonth: string, amount: number) {
    if (!editing) return;
    const data: { rules?: BudgetRuleDTO[] } = await fetch("/api/expenses/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: editing.category.id, effectiveFrom: yearMonth, amount }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    // 編輯既有的那一筆時如果把月份也改掉了，原本那一筆要刪掉——upsert 是用
    // 「分類＋生效月份」當鍵，換了月份等於另外新增一筆，不刪的話舊的會留著。
    let latest = data.rules;
    const old = editing.rule;
    if (old && !isLegacyRule(old) && old.effectiveFrom !== yearMonth) {
      const after: { rules?: BudgetRuleDTO[] } = await fetch(`/api/expenses/budgets?id=${old.id}`, { method: "DELETE" })
        .then((res) => res.json())
        .catch(() => ({}));
      if (after.rules) latest = after.rules;
    }
    if (latest) setRules(latest);
    // 預算是 upsert（同一個分類＋同一個生效月份只會有一筆），所以一律講「儲存成功」
    // ——使用者分不出這次到底是新增還是改掉既有那一筆，說錯比不說更糟。
    showToast(TOAST.saved);
    setEditing(null);
  }

  async function handleDeleteRule(ruleId: string) {
    const data: { rules?: BudgetRuleDTO[] } = await fetch(`/api/expenses/budgets?id=${ruleId}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
    showToast(TOAST.deleted);
  }

  /** 批次設定：選到的每個分類各寫一筆「從同一個月起多少」。
   *
   *  逐筆依序送，不是 Promise.all：每一筆的回傳都是「這個使用者目前完整的規則清單」，
   *  併發送出時幾個回應會互相覆蓋，最後留在畫面上的是最早回來那一份（看起來像有幾筆
   *  沒存到，重新整理才出現）。 */
  async function handleBatchSave(yearMonth: string, items: BudgetBatchItem[]) {
    const latest = await runBusy("儲存中…", async () => {
      let rulesNow = rules;
      for (const item of items) {
        const data: { rules?: BudgetRuleDTO[] } = await fetch("/api/expenses/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: item.categoryId, effectiveFrom: yearMonth, amount: item.amount }),
        })
          .then((res) => res.json())
          .catch(() => ({}));
        if (data.rules) rulesNow = data.rules;
      }
      return rulesNow;
    });
    setRules(latest);
    setBatchOpen(false);
    selection.exit();
    showToast(`已設定 ${items.length} 個分類的預算`);
  }

  /** 批次清除：把選到的分類設過的每一筆都刪掉，變回「未設定」。
   *
   *  改版前存在分類身上的那一筆（legacy）資料庫裡沒有對應文件可以刪，所以改成補一筆
   *  金額 0 蓋掉它——不然清除之後它會原地復活，使用者以為沒清掉。 */
  async function handleBatchClear() {
    const ids = [...selection.selectedIds];
    const latest = await runBusy("清除中…", async () => {
      let rulesNow = rules;
      for (const categoryId of ids) {
        for (const rule of rulesForCategory(withLegacyCategoryBudgets(rulesNow, categories), categoryId)) {
          const data: { rules?: BudgetRuleDTO[] } = await (
            isLegacyRule(rule)
              ? fetch("/api/expenses/budgets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ categoryId, effectiveFrom: thisMonth, amount: 0 }),
                })
              : fetch(`/api/expenses/budgets?id=${rule.id}`, { method: "DELETE" })
          )
            .then((res) => res.json())
            .catch(() => ({}));
          if (data.rules) rulesNow = data.rules;
        }
      }
      return rulesNow;
    });
    setRules(latest);
    setClearConfirm(false);
    selection.exit();
    showToast(`已清除 ${ids.length} 個分類的預算`);
  }

  const expenseCategories = topLevelCategories(categories, "支出");
  // 只有主分類可以選（子分類不在這一頁，預算本來就是編在主分類上）。
  const selection = useSelection(expenseCategories.map((c) => c.id));
  // 改版前存在分類身上的舊預算會補成一筆虛擬規則，使用者的舊設定不會因為改版就不見。
  const effectiveRules = withLegacyCategoryBudgets(rules, categories);
  const thisMonth = currentYearMonth();

  return (
    <div className="flex flex-col gap-4">
      {/* 標題跟「選取」排同一列一起釘在頂端（跟帳戶類型、存錢目標那幾頁同一套）：
          分類多的時候要編的那一張卡常常在最下面，勾完之後動作鍵還在最上面。 */}
      <StickyToolbar>
        <PageHeader
          flush
          title="預算設定"
          help="選擇分類、起始月份和每月金額。之後沿用到下一次調整，過去月份保留原金額。"
          actions={
            expenseCategories.length > 0 ? (
              <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />
            ) : undefined
          }
        />
        {selection.selecting && (
          <SelectionBar
            count={selection.selectedIds.size}
            total={selection.total}
            unit="個分類"
            actions={[{ label: "設定預算", onClick: () => setBatchOpen(true) }]}
            onToggleAll={selection.toggleAll}
            onDelete={() => setClearConfirm(true)}
            deleteLabel="清除預算"
          />
        )}
      </StickyToolbar>

      {expenseCategories.length === 0 ? (
        <p className={text.faint}>沒有可設定預算的支出分類。先到「收支分類」新增。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {expenseCategories.map((c) => {
            const history = rulesForCategory(effectiveRules, c.id);
            const current = budgetForMonth(effectiveRules, c.id, thisMonth);
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                <ListRow
                  icon={c.icon}
                  iconClassName={categoryColorClass[c.color]}
                  name={c.name}
                  leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(c.id)} /> : undefined}
                  // 右邊是「這個月實際生效的金額」，不是最後一筆設定——最後一筆有可能是
                  // 設在未來的月份，那筆現在還沒生效。
                  right={
                    <span className={current && current > 0 ? "tabular-nums text-sm font-semibold text-[#4A3B7C]" : `text-sm ${text.faint}`}>
                      {current === undefined ? "未設定" : current > 0 ? formatCurrency(current) : "停止設定預算"}
                    </span>
                  }
                  onClick={() => (selection.selecting ? selection.toggle(c.id) : setEditing({ category: c }))}
                />

                {/* 設過的幾筆直接攤在分類名稱下方，不用點進去才看得到「幾月改成多少」。
                    排法跟收支分類頁的子項目同一套（淡色區塊＋分隔線）。 */}
                {history.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
                    {history.map((rule) => {
                      // 舊版存在分類身上的預算會補成一筆沒有生效月份的虛擬規則，資料庫裡
                      // 沒有這一筆可以刪或改；設一筆新的就會蓋過它。
                      const legacy = isLegacyRule(rule);
                      return (
                        <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                          {/* 選取模式中這幾列只是資訊：這時候要做的是「挑分類」，讓人點進
                              單筆編輯會把剛勾好的一批丟在半路（而且下面那顆刪除也跟工具列
                              上的「清除預算」撞在一起）。 */}
                          <button
                            type="button"
                            disabled={legacy || selection.selecting}
                            onClick={() => setEditing({ category: c, rule })}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                          >
                            <span className={text.body}>{legacy ? "改版前的設定" : `${formatYearMonth(rule.effectiveFrom)} 起`}</span>
                            <span className="shrink-0 tabular-nums text-sm font-medium text-[#4A3B7C]">
                              {rule.amount > 0 ? formatCurrency(rule.amount) : "停止設定預算"}
                            </span>
                          </button>
                          {legacy && <span className={`shrink-0 text-xs ${text.faint}`}>沿用中</span>}
                          {!legacy && !selection.selecting && (
                            <button type="button" onClick={() => handleDeleteRule(rule.id)} className="shrink-0 text-xs font-medium text-[#D1517E]">
                              刪除
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BudgetModal
        // key 綁在「哪個分類、哪一筆」上，換一個目標再開時彈窗裡的月份跟金額才會是
        // 那一筆的值，不是上一次留下的。
        key={editing ? `${editing.category.id}-${editing.rule?.id ?? "new"}` : "closed"}
        open={editing !== null}
        category={editing?.category ?? null}
        initialYearMonth={editing?.rule?.effectiveFrom && !isLegacyRule(editing.rule) ? editing.rule.effectiveFrom : thisMonth}
        currentAmount={editing?.rule?.amount ?? (editing ? (budgetForMonth(effectiveRules, editing.category.id, thisMonth) ?? 0) : 0)}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />

      {/* 批次設定：一個共用的生效月份＋每個分類一列金額（見 BudgetBatchModal）。
          key 綁在選到哪幾個分類上，重新勾一批再開時每一列的預設值才會是那幾個分類
          當下的金額，不是上一次留下的。 */}
      <BudgetBatchModal
        // 關起來時的 key 不能跟上面那個 BudgetModal 一樣寫 "closed"：兩個是同一層的
        // 兄弟節點，React 會說「有兩個小孩用同一個 key」，而且兩個彈窗的狀態會互相竄位。
        key={batchOpen ? `batch-${[...selection.selectedIds].sort().join(",")}` : "batch-closed"}
        open={batchOpen}
        categories={expenseCategories.filter((c) => selection.selectedIds.has(c.id))}
        defaultYearMonth={thisMonth}
        currentAmounts={Object.fromEntries(expenseCategories.map((c) => [c.id, budgetForMonth(effectiveRules, c.id, thisMonth)]))}
        onClose={() => setBatchOpen(false)}
        onSave={handleBatchSave}
      />

      <ConfirmModal
        open={clearConfirm}
        title={`清除 ${selection.selectedIds.size} 個分類的預算`}
        message="選到的分類設過的每一筆預算都會刪掉，變回「未設定」。已經記下的消費不會動到，之後要用再重新設定。"
        confirmLabel="清除"
        onConfirm={handleBatchClear}
        onClose={() => setClearConfirm(false)}
      />
    </div>
  );
}
