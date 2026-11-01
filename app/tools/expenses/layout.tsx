import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { expensesPetState } from "@/lib/expenses/page-data.server";

/** 包住 (workspace) 底下所有記帳本頁面，在這一層統一擋工具權限。
 *
 *  固定收支本來在這裡自動入帳，已經移除：「固定」收支其實沒那麼固定（電話費每個月
 *  金額不一樣、某個月根本沒扣款），自動寫進去會默默生出跟實際不符的紀錄。改成到期的
 *  那幾期列在固定收支頁的「待確認」區，使用者按確認才入帳（見 listPendingOccurrences）。 */
export default async function ExpensesToolLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "expenses")) return <ToolAccessDenied toolName="記帳本" />;
  // 養成的星星幣結算掛在 layout 而不是每一頁：使用者可能先記完帳就離開、沒進養成頁，
  // 獎勵還是要算到。擺在這裡的好處是 layout 跟 page 平行算繪，它不會拖慢頁面本身的
  // 資料讀取（養成頁自己會 await 同一支拿結算結果，見 page-data.server.ts）。
  // expensesUserId() 它內部就會呼叫，這裡不用再叫一次。
  await expensesPetState();
  return children;
}
