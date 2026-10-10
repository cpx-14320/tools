import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TransitShell } from "@/components/transit/transit-shell";

export const metadata: Metadata = { title: "搭車咻一下" };

export default function TransitLayout({ children }: { children: ReactNode }) {
  return <TransitShell>{children}</TransitShell>;
}
