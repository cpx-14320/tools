import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = { title: "圖片壓縮" };

/** 權限檢查比照搭乘車／記帳本那兩層 layout：沒登入導去登入頁、沒被勾選這個工具就給
 *  無權限畫面。
 *
 *  **外殼直接用 SiteShell，沒有自己的一套**：搭乘車跟記帳本各有外殼是因為它們有底部頁籤
 *  跟好幾層頁面要共用；這個工具就一頁、沒有分頁，再刻一份 CompressShell 只會變成第三份
 *  要跟著維護的同款外框。左上角的返回鍵直接回工具列表。 */
export default async function CompressLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "compress")) return <ToolAccessDenied toolName="圖片壓縮" />;
  return <SiteShell back={{ href: "/", label: "工具列表" }}>{children}</SiteShell>;
}
