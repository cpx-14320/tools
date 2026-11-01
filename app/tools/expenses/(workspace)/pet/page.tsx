import type { Metadata } from "next";
import { PetView } from "./pet-view";
import { expensesPetState, expensesUserId } from "@/lib/expenses/page-data.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "養成" };
export const dynamic = "force-dynamic";

export default async function PetPage() {
  // 養成頁要的是 expensesPetState() 那一次結算的結果，不是自己再結算一次：獎勵是
  // 「發過就不再發」的，自己再跑一次 settlePetRewards 的話 justEarned 會是空的，
  // 「獲得 N 顆星星幣」那句提示就永遠不會出現（cache 過，layout 先跑也是同一批）。
  const userId = await expensesUserId();
  const [pet, accounts, accountTypes, categories, transactions, transfers] = await Promise.all([
    expensesPetState(),
    listAccounts(userId),
    listAccountTypes(userId),
    listCategories(userId),
    listTransactions(userId),
    listTransfers(userId),
  ]);
  return (
    <PetView
      initialPet={pet}
      accounts={accounts}
      accountTypes={accountTypes}
      categories={categories}
      transactions={transactions}
      transfers={transfers}
    />
  );
}
