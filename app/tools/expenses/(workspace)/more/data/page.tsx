import type { Metadata } from "next";
import { DataView } from "./data-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listBudgetRules } from "@/lib/expenses/budgets.server";
import { listAccounts } from "@/lib/expenses/accounts.server";

export const metadata: Metadata = { title: "匯出／匯入資料" };
export const dynamic = "force-dynamic";

export default async function DataPage() {
  const userId = await expensesUserId();
  const [categories, transactions, budgetRules, accounts] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listBudgetRules(userId),
    listAccounts(userId),
  ]);
  return <DataView initialCategories={categories} transactions={transactions} budgetRules={budgetRules} accounts={accounts} />;
}
