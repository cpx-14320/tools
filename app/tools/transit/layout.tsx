import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DreamShell } from "@/components/dream/dream-shell";

export const metadata: Metadata = { title: "夢幻紫彩火車旅行" };

export default function DreamLayout({ children }: { children: ReactNode }) {
  return <DreamShell>{children}</DreamShell>;
}
