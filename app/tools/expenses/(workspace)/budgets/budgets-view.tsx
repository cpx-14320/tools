"use client";

import { useEffect, useState } from "react";
import { ListCardSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { Card, CardBody } from "@/components/expenses/card";
import { DateField } from "@/components/expenses/date-field";
import { ListProgressRow } from "@/components/expenses/list-progress-row";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { BudgetModal } from "@/components/expenses/budget-modal";
import { text } from "@/components/expenses/theme";
import { budgetForMonth, withLegacyCategoryBudgets, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import {
  topLevelCategories,
  topLevelCategoryId,
  categoryById,
  categoryColorClass,
  categoryFillClass,
  type CategoryDTO,
} from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 預算設定頁——預算從「新增分類」彈窗搬出來獨立成一頁，而且改成可以按月份分別設定：
 *  上面選月份，下面列出所有支出分類在那個月各自的預算。設定時存的是「從這個月起生效」
 *  的規則，之後的月份自動沿用，不用每個月重設（見 lib/expenses/budgets.ts）。 */
export function BudgetsView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  const [rules, setRules] = useState<BudgetRuleDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [ready, setReady] = useState(false);
  // 載入中畫骨架，列數用上次記住的實際筆數（見 skeleton-count.ts）。
  const skeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:budgets", 6, ready ? categories.filter((c) => !c.parentId && c.kind === "支出").length : undefined);
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [editing, setEditing] = useState<CategoryDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/budgets").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
    ])
      .then(([catData, budgetData, txData]: [{ categories?: CategoryDTO[] }, { rules?: BudgetRuleDTO[] }, { transactions?: TransactionDTO[] }]) => {
        if (cancelled) return;
        setCategories(catData.categories ?? []);
        setRules(budgetData.rules ?? []);
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

  async function handleSave(amount: number) {
    if (!editing) return;
    const data: { rules?: BudgetRuleDTO[] } = await fetch("/api/expenses/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: editing.id, effectiveFrom: yearMonth, amount }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
    setEditing(null);
  }

  async function handleDeleteRule(ruleId: string) {
    const data: { rules?: BudgetRuleDTO[] } = await fetch(`/api/expenses/budgets?id=${ruleId}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.rules) setRules(data.rules);
  }

  const expenseCategories = topLevelCategories(categories, "支出");
  // 改版前存在分類身上的舊預算會補成一筆虛擬規則，使用者的舊設定不會因為改版就不見。
  const effectiveRules = withLegacyCategoryBudgets(rules, categories);
  const monthTotal = expenseCategories.reduce((sum, c) => sum + (budgetForMonth(effectiveRules, c.id, yearMonth) ?? 0), 0);

  // 這個月各大分類實際花掉多少（子分類的金額算到它的大分類底下，跟首頁的預算卡一致）。
  const spentByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.date.slice(0, 7) !== yearMonth) continue;
    const cat = categoryById(categories, t.categoryId);
    if (cat?.kind !== "支出") continue;
    const topId = topLevelCategoryId(categories, t.categoryId);
    spentByCategory.set(topId, (spentByCategory.get(topId) ?? 0) + t.amount);
  }
  const monthSpent = expenseCategories.reduce(
    (sum, c) => sum + ((budgetForMonth(effectiveRules, c.id, yearMonth) ?? 0) > 0 ? (spentByCategory.get(c.id) ?? 0) : 0),
    0,
  );
  const monthPct = monthTotal > 0 ? Math.round((monthSpent / monthTotal) * 100) : 0;

  return (
    <div>
      <PageHeader title="預算設定" help="選月份設定各分類的預算，設定後往後的月份會沿用，要調整時再設一筆新的就好" />

      <div className="mb-4">
        <label className="flex flex-col gap-1.5">
          <span className={text.label}>月份</span>
          <DateField value={yearMonth} onChange={setYearMonth} granularity="month" />
        </label>
      </div>

      <Card className="mb-4">
        <CardBody>
          <p className={text.muted}>{yearMonth} 總預算</p>
          <div className="mt-0.5 flex items-end justify-between">
            <p className={text.statValue}>
              {formatCurrency(monthSpent)}
              <span className="ml-1 text-sm font-normal text-[#9C94C4]">/ {formatCurrency(monthTotal)}</span>
            </p>
            <span className={`text-xs font-semibold ${monthSpent > monthTotal ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{monthPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3EFFC]">
            <div
              className={`h-full rounded-full ${monthSpent > monthTotal ? "bg-[#D1517E]" : "bg-[#6F5FD6]"}`}
              style={{ width: `${Math.min(100, Math.max(monthPct, 0))}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {!skeletonReady ? null : !ready ? (
        <ListCardSkeleton count={skeletonCount} progress />
      ) : expenseCategories.length === 0 ? (
        <p className={text.faint}>還沒有任何支出分類，先去「收支分類」建立分類才能編預算</p>
      ) : (
        <ListCard>
          {expenseCategories.map((c) => {
            const amount = budgetForMonth(effectiveRules, c.id, yearMonth) ?? 0;
            const spent = spentByCategory.get(c.id) ?? 0;
            // 沒編預算的分類不畫進度條（沒有分母），但仍然顯示這個月已經花了多少——
            // 看到「這類其實每個月都在花」正是決定要不要幫它編預算的依據。
            if (amount <= 0) {
              return (
                <ListRow
                  key={c.id}
                  icon={c.icon}
                  iconClassName={categoryColorClass[c.color]}
                  name={c.name}
                  right={<span className="text-sm text-[#B3ABD4]">{spent > 0 ? `已花 ${formatCurrency(spent)}・未編預算` : "未編預算"}</span>}
                  chevron
                  onClick={() => setEditing(c)}
                />
              );
            }
            const pct = Math.round((spent / amount) * 100);
            const over = spent > amount;
            // 這一頁是「設定預算」，不是看進度的地方——花費速度的提醒只放在首頁的本月預算，
            // 這裡每一列都掛一行紅字只會讓設定清單變得很吵。
            return (
              <button key={c.id} type="button" onClick={() => setEditing(c)} className="w-full px-4 py-3.5 text-left">
                <div className="flex w-full items-center gap-3">
                  <ListProgressRow
                    icon={c.icon}
                    iconClassName={categoryColorClass[c.color]}
                    name={c.name}
                    amount={`${formatCurrency(spent)} / ${formatCurrency(amount)}`}
                    pct={pct}
                    pctLabel={
                      <span className={over ? "font-semibold text-[#D1517E]" : undefined}>
                        {over ? `超支 ${formatCurrency(spent - amount)}` : `剩 ${formatCurrency(amount - spent)}`}
                      </span>
                    }
                    barColorClass={over ? "bg-[#D1517E]" : categoryFillClass[c.color]}
                  />
                </div>
              </button>
            );
          })}
        </ListCard>
      )}

      <BudgetModal
        key={editing ? `${editing.id}-${yearMonth}` : "closed"}
        open={editing !== null}
        category={editing}
        yearMonth={yearMonth}
        rules={effectiveRules}
        currentAmount={editing ? (budgetForMonth(effectiveRules, editing.id, yearMonth) ?? 0) : 0}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDeleteRule={handleDeleteRule}
      />
    </div>
  );
}
