import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExpensesShell } from "@/components/expenses/expenses-shell";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "記帳本" };

/** 這裡**不**擋沒登入／沒權限的人：layout 跟 page 是平行算繪的，layout 的 redirect
 *  擋不住 page 去讀資料，所以那一關一律由 expensesUserId() 在每一頁自己把關
 *  （見 lib/expenses/page-data.server.ts）。這裡只是順手把 id 讀出來給外殼用——
 *  getSessionUser 有 cache()，跟 page 共用同一趟查詢，不會多花一次。
 *
 *  讀不到使用者就傳空字串，不要在這裡 redirect：page 那邊已經會導，這裡再導一次只是
 *  兩個地方做同一件事。 */
export default async function ExpensesLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return <ExpensesShell userId={user?.id ?? ""}>{children}</ExpensesShell>;
}
