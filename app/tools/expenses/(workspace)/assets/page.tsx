import type { Metadata } from "next";
import { AssetsView } from "./assets-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "資產總表" };
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const userId = await expensesUserId();
  const [accounts, accountTypes, transactions, categories, transfers] = await Promise.all([
    listAccounts(userId),
    listAccountTypes(userId),
    listTransactions(userId),
    listCategories(userId),
    listTransfers(userId),
  ]);
  return (
    <AssetsView
      initialAccounts={accounts}
      initialAccountTypes={accountTypes}
      transactions={transactions}
      categories={categories}
      initialTransfers={transfers}
    />
  );
}
