import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { TransitShell } from "@/components/transit/transit-shell";

export const metadata: Metadata = { title: "搭車咻一下" };

export default async function TransitLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "transit")) return <ToolAccessDenied toolName="搭乘車查詢" />;
  return <TransitShell>{children}</TransitShell>;
}
