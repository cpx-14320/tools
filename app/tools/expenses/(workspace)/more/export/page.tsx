import type { Metadata } from "next";
import { ExportView } from "./export-view";

export const metadata: Metadata = { title: "匯出資料" };

export default function ExportPage() {
  return <ExportView />;
}
