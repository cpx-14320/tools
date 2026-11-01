import type { Metadata } from "next";
import { AccountTypesView } from "./account-types-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listAccounts } from "@/lib/expenses/accounts.server";

export const metadata: Metadata = { title: "帳戶類型" };
/** 每次進頁都重新讀——類型跟帳戶會改，快取住會讓人以為剛剛那筆沒存到。 */
export const dynamic = "force-dynamic";

export default async function AccountTypesPage() {
  const userId = await expensesUserId();
  const [accountTypes, accounts] = await Promise.all([listAccountTypes(userId), listAccounts(userId)]);
  return <AccountTypesView initialAccountTypes={accountTypes} accounts={accounts} />;
}
