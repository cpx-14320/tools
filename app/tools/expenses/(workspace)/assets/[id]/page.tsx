import type { Metadata } from "next";
import { AccountDetailView } from "./account-detail-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "帳戶明細" };
export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await expensesUserId();
  const [accounts, accountTypes, categories, transactions, transfers] = await Promise.all([
    listAccounts(userId),
    listAccountTypes(userId),
    listCategories(userId),
    listTransactions(userId),
    listTransfers(userId),
  ]);
  // 刻意不在這裡 notFound()：帳戶刪掉之後 view 自己會把 accounts 更新掉，由它顯示
  // 「找不到這個帳戶，可能已經被刪除」比整頁換成 404 好讀。
  return (
    <AccountDetailView
      accountId={id}
      initialAccounts={accounts}
      initialAccountTypes={accountTypes}
      initialCategories={categories}
      initialTransactions={transactions}
      initialTransfers={transfers}
    />
  );
}
