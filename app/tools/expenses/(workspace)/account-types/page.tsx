import type { Metadata } from "next";
import { AccountTypesView } from "./account-types-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";

export const metadata: Metadata = { title: "帳戶類型" };
/** 每次進頁都重新讀——類型跟帳戶會改，快取住會讓人以為剛剛那筆沒存到。 */
export const dynamic = "force-dynamic";

export default async function AccountTypesPage() {
  const userId = await expensesUserId();
  // 只要類型本身——帳戶清單以前是拿來算「這個類型有幾個帳戶在用」的，那段提示拿掉後
  // 就不需要了（編輯彈窗裡的資產／負債現在一律唯讀）。
  const accountTypes = await listAccountTypes(userId);
  return <AccountTypesView initialAccountTypes={accountTypes} />;
}
