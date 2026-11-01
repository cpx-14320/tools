import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { expensesPetState } from "@/lib/expenses/page-data.server";

/** 包住 (workspace) 底下所有記帳本頁面，在這一層統一擋工具權限。
 *
 *  沒有權限的人直接導回首頁，不顯示「無權限瀏覽」那個畫面：那個畫面本身就是一種瀏覽，
 *  網址列還停在 /tools/expenses、看得出這個工具存在、叫什麼名字。首頁的工具卡片本來就
 *  會把沒權限的那張灰掉，該知道的事在那裡講就夠了。
 *
 *  真正把資料擋住的是兩個地方，不是這裡：API route 全部走 requireTool（403），頁面則是
 *  expensesUserId() 裡同一份權限判斷——**layout 跟 page 是平行算繪的**，光在這裡導頁
 *  擋不住 page 去讀資料。
 *
 *  固定收支本來在這裡自動入帳，已經移除：「固定」收支其實沒那麼固定（電話費每個月
 *  金額不一樣、某個月根本沒扣款），自動寫進去會默默生出跟實際不符的紀錄。改成到期的
 *  那幾期列在固定收支頁的「待確認」區，使用者按確認才入帳（見 listPendingOccurrences）。 */
export default async function ExpensesToolLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "expenses")) redirect("/");
  // 養成的星星幣結算掛在 layout 而不是每一頁：使用者可能先記完帳就離開、沒進養成頁，
  // 獎勵還是要算到。擺在這裡的好處是 layout 跟 page 平行算繪，它不會拖慢頁面本身的
  // 資料讀取（養成頁自己會 await 同一支拿結算結果，見 page-data.server.ts）。
  // expensesUserId() 它內部就會呼叫，這裡不用再叫一次。
  await expensesPetState();
  return children;
}
