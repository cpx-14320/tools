import type { Metadata } from "next";
import { RecurringView } from "./recurring-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listGoals } from "@/lib/expenses/goals.server";
import { listPendingOccurrences, listRecurringRules } from "@/lib/expenses/recurring-rules.server";

export const metadata: Metadata = { title: "固定收支" };
export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const userId = await expensesUserId();
  const [categories, transactions, rules, goals, pending] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listRecurringRules(userId),
    listGoals(userId),
    listPendingOccurrences(userId),
  ]);
  return (
    <RecurringView
      initialCategories={categories}
      initialTransactions={transactions}
      initialRules={rules}
      goals={goals}
      initialPending={pending}
    />
  );
}
