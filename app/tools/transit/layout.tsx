import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TransitShell } from "@/components/transit-shell";

export const metadata: Metadata = { title: "搭乘車查詢" };

export default function TransitLayout({ children }: { children: ReactNode }) {
  return <TransitShell>{children}</TransitShell>;
}
