import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DreamShell } from "@/components/dream/dream-shell";

export const metadata: Metadata = { title: "搭車咻一下" };

export default function DreamLayout({ children }: { children: ReactNode }) {
  return <DreamShell>{children}</DreamShell>;
}
