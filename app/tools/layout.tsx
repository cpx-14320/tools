import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

/** 所有 /tools/* 底下的工具共用這一層：沒登入就整批擋掉、導去登入頁。
 *  目前還沒有「這個工具你有沒有權限」的檢查——只要登入了，底下工具都能用，
 *  之後要加權限控管時再依 toolsRegistry／使用者的 tools 清單在這裡多判斷一層即可。 */
export default async function ToolsLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return children;
}
