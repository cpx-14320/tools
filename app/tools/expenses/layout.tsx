import type { ReactNode } from "react";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { autoConfirmDueOccurrences } from "@/lib/expenses/recurring-rules.server";
import { seedExpensesPresets } from "@/lib/expenses/presets.server";

/** 包住 (workspace) 底下所有頁面跟 ledgers/page.tsx——兩邊都屬於「記帳本」這個工具，
 *  在這一層統一檔，不用在 (workspace)/layout.tsx 跟 ledgers 各自重複檢查一次。
 *
 *  固定收支的自動入帳也掛在這裡：這個 layout 是 Server Component，每次進記帳本任何
 *  頁面都會重新執行，是最自然的「每次都檢查一下有沒有到期」時機，不需要真的排程器。
 *  多久沒開都沒關係，缺的那幾期會一次補齊（見 autoConfirmDueOccurrences）。失敗不擋
 *  頁面渲染——自動入帳是錦上添花，不該因為它出錯就讓整個記帳本打不開。 */
export default async function ExpensesToolLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "expenses")) return <ToolAccessDenied toolName="記帳本" />;
  // 預設分類／帳戶要在固定收支自動入帳之前建好——順序上沒有硬性依賴，但先有分類比較
  // 符合「第一次進來就看得到東西」的預期。兩者都是盡力而為，失敗不擋頁面。
  const userId = new ObjectId(user.id);
  await seedExpensesPresets(userId).catch(() => {});
  await autoConfirmDueOccurrences(userId).catch(() => {});
  return children;
}
