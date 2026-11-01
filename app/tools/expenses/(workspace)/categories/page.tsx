import type { Metadata } from "next";
import { CategoriesView } from "./categories-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { countByCategory } from "@/lib/expenses/transactions.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";

export const metadata: Metadata = { title: "收支分類" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const userId = await expensesUserId();
  const [categories, counts, accounts, accountTypes] = await Promise.all([
    listCategories(userId),
    countByCategory(userId),
    listAccounts(userId),
    listAccountTypes(userId),
  ]);
  return <CategoriesView initialCategories={categories} counts={counts} accounts={accounts} accountTypes={accountTypes} />;
}
