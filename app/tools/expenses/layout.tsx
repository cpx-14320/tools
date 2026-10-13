import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";

/** 包住 (workspace) 底下所有頁面跟 ledgers/page.tsx——兩邊都屬於「記帳本」這個工具，
 *  在這一層統一檔，不用在 (workspace)/layout.tsx 跟 ledgers 各自重複檢查一次。 */
export default async function ExpensesToolLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "expenses")) return <ToolAccessDenied toolName="記帳本" />;
  return children;
}
