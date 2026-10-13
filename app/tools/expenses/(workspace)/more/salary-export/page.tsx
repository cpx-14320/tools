import type { Metadata } from "next";
import { SalaryExportView } from "./export-view";

export const metadata: Metadata = { title: "匯出薪資紀錄" };

export default function SalaryExportPage() {
  return <SalaryExportView />;
}
