import type { Metadata } from "next";
import { BudgetsView } from "./budgets-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listBudgetRules } from "@/lib/expenses/budgets.server";
import { listCategories } from "@/lib/expenses/categories.server";

export const metadata: Metadata = { title: "預算設定" };
/** 每次進頁都重新讀——預算跟分類是會改的東西，快取住會讓人以為剛剛那筆沒存到。 */
export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const userId = await expensesUserId();
  const [categories, rules] = await Promise.all([listCategories(userId), listBudgetRules(userId)]);
  return <BudgetsView initialCategories={categories} initialRules={rules} />;
}
