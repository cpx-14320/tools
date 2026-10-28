"use client";

import { useEffect, useState } from "react";
import { GroupedCardsSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonShape, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { TOAST, useToast } from "@/components/expenses/toast";
import { PageHeader } from "@/components/expenses/page-header";
import { ListRow } from "@/components/expenses/list-row";
import { BudgetModal } from "@/components/expenses/budget-modal";
import { text } from "@/components/expenses/theme";
import { budgetForMonth, isLegacyRule, rulesForCategory, withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import { topLevelCategories, categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency } from "@/lib/format";

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
export function BudgetsView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const showToast = useToast();
  const skeletonReady = useSkeletonReady();
  const [rules, setRules] = useState<BudgetRuleDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/budgets").then((res) => res.json()),
    ])
      .then(([catData, budgetData]: [{ categories?: CategoryDTO[] }, { rules?: BudgetRuleDTO[] }]) => {
        if (cancelled) return;
        setCategories(catData.categories ?? []);
        setRules(budgetData.rules ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const expenseCategories = topLevelCategories(categories, "支出");
  // 改版前存在分類身上的舊預算會補成一筆虛擬規則，使用者的舊設定不會因為改版就不見。
  const effectiveRules = withLegacyCategoryBudgets(rules, categories);
  const thisMonth = currentYearMonth();
  // 載入中畫骨架。版面跟收支分類一樣是「一個分類一張卡、底下掛它設過的那幾筆」，
  // 所以記的是形狀（每張卡有幾筆規則）而不是單一列數。
  const skeletonShape = useSkeletonShape(
    "cpx-tools:expenses-skeleton:budgets",
    [0, 1, 0, 0, 0, 0],
    ready ? expenseCategories.map((c) => rulesForCategory(effectiveRules, c.id).length) : undefined,
  );

  return (
    <div>
      <PageHeader title="預算設定" help="點分類設定「從哪個月起每月多少」，之後的月份會沿用；要調整時再設一筆新的，之前的月份不會被追溯蓋掉" />

      {!skeletonReady ? null : !ready ? (
        <GroupedCardsSkeleton shape={skeletonShape} />
      ) : expenseCategories.length === 0 ? (
        <p className={text.faint}>還沒有任何支出分類，先去「收支分類」建立分類才能編預算</p>
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
                  // 右邊是「這個月實際生效的金額」，不是最後一筆設定——最後一筆有可能是
                  // 設在未來的月份，那筆現在還沒生效。
                  right={
                    <span className={current && current > 0 ? "tabular-nums text-sm font-semibold text-[#4A3B7C]" : `text-sm ${text.faint}`}>
                      {current === undefined ? "未編預算" : current > 0 ? formatCurrency(current) : "不編預算"}
                    </span>
                  }
                  onClick={() => setEditing({ category: c })}
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
                          <button
                            type="button"
                            disabled={legacy}
                            onClick={() => setEditing({ category: c, rule })}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                          >
                            <span className={text.body}>{legacy ? "改版前的設定" : `${rule.effectiveFrom} 起`}</span>
                            <span className="shrink-0 tabular-nums text-sm font-medium text-[#4A3B7C]">
                              {rule.amount > 0 ? formatCurrency(rule.amount) : "不編預算"}
                            </span>
                          </button>
                          {legacy ? (
                            <span className={`shrink-0 text-xs ${text.faint}`}>沿用中</span>
                          ) : (
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
    </div>
  );
}
