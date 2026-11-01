import type { Metadata } from "next";
import { ReportsView } from "./reports-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "報表" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const userId = await expensesUserId();
  const [categories, transactions, accounts, accountTypes, transfers] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listAccounts(userId),
    listAccountTypes(userId),
    listTransfers(userId),
  ]);
  return (
    <ReportsView categories={categories} transactions={transactions} accounts={accounts} accountTypes={accountTypes} transfers={transfers} />
  );
}
