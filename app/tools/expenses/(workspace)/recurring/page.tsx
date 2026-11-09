import type { Metadata } from "next";
import { RecurringView } from "./recurring-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listGoalsWithProgress } from "@/lib/expenses/goals.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransfers } from "@/lib/expenses/transfers.server";
import { listPendingOccurrences, listRecurringRules } from "@/lib/expenses/recurring-rules.server";

export const metadata: Metadata = { title: "固定收支" };
export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const userId = await expensesUserId();
  // 帳戶跟類型是給「轉帳」類型的規則用的（要選轉出／轉入帳戶）。
  const [categories, transactions, rules, goals, pending, accounts, accountTypes, transfers] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listRecurringRules(userId),
    listGoalsWithProgress(userId),
    listPendingOccurrences(userId),
    listAccounts(userId),
    listAccountTypes(userId),
    // 「轉帳」類型的規則入帳成的是轉帳而不是交易，算「已入帳幾期」要查這一份。
    listTransfers(userId),
  ]);
  return (
    <RecurringView
      initialCategories={categories}
      initialTransactions={transactions}
      initialRules={rules}
      accounts={accounts}
      accountTypes={accountTypes}
      transfers={transfers}
      goals={goals}
      initialPending={pending}
    />
  );
}
