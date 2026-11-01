import type { Metadata } from "next";
import { Suspense } from "react";
import { TransactionsView } from "./transactions-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "消費紀錄" };
export const dynamic = "force-dynamic";

/** TransactionsView 用 useSearchParams 讀 ?kind=收入（首頁「收入來源」的查看全部會帶過來），
 *  Next.js 要求用到 useSearchParams 的元件外面要包 Suspense，不然 build 時會報錯。 */
export default async function TransactionsPage() {
  const userId = await expensesUserId();
  const [categories, transactions, accounts, accountTypes, transfers] = await Promise.all([
    listCategories(userId),
    listTransactions(userId),
    listAccounts(userId),
    listAccountTypes(userId),
    listTransfers(userId),
  ]);
  return (
    <Suspense fallback={null}>
      <TransactionsView
        initialCategories={categories}
        initialTransactions={transactions}
        accounts={accounts}
        accountTypes={accountTypes}
        transfers={transfers}
      />
    </Suspense>
  );
}
