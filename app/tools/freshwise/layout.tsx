import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { FreshwiseShell } from "@/components/freshwise/freshwise-shell";

export const metadata: Metadata = { title: "菜鳥買菜記" };

/** 跟其他工具同一套把關：沒登入踢回登入頁，有登入但沒有這個工具的權限就顯示沒有權限的
 *  畫面（不是 404——使用者該知道的是「要請管理者開權限」，不是「這頁不存在」）。
 *
 *  注意：toolsRegistry 新增 freshwise 之後，**既有帳號的 tools 陣列裡不會自動多這一個**
 *  （lib/auth.ts 的 createUser 只在註冊當下抓一次當時的工具清單）。既有帳號要到 /admin
 *  把這個工具勾給他，才看得到。新註冊的帳號會自動拿到。 */
export default async function FreshwiseLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "freshwise")) return <ToolAccessDenied toolName="菜鳥買菜記" />;
  return <FreshwiseShell>{children}</FreshwiseShell>;
}
