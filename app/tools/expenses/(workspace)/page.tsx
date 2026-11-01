import { DashboardView } from "./dashboard-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransfers } from "@/lib/expenses/transfers.server";
import { listBudgetRules } from "@/lib/expenses/budgets.server";
import { newOsSeed } from "@/lib/expenses/pet-os";

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
      // 主視覺那顆對話框要抽哪幾句，用這個 seed 決定。一定要在伺服器產生再傳下來，
      // 不能在 client 元件裡自己抽：伺服器跟瀏覽器會各抽各的，hydration 對不起來
      // （見 lib/expenses/pet-os.ts 的 seededShuffle）。每次請求都是新的數字，所以
      // 「每次重新整理換一批句子」還是成立。
      osSeed={newOsSeed()}
    />
  );
}
