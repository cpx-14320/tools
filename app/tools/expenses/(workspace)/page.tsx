import { DashboardView } from "./dashboard-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransfers } from "@/lib/expenses/transfers.server";
import { listBudgetRules } from "@/lib/expenses/budgets.server";

export const dynamic = "force-dynamic";

export default async function ExpensesDashboardPage() {
  const userId = await expensesUserId();
  const [categories, transactions, accounts, accountTypes, transfers, budgetRules] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listAccounts(userId),
    listAccountTypes(userId),
    listTransfers(userId),
    listBudgetRules(userId),
  ]);
  return (
    <DashboardView
      initialCategories={categories}
      initialTransactions={transactions}
      accounts={accounts}
      accountTypes={accountTypes}
      transfers={transfers}
      budgetRules={budgetRules}
    />
  );
}
