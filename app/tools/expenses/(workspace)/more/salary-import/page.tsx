import type { Metadata } from "next";
import { SalaryImportView } from "./import-view";

export const metadata: Metadata = { title: "匯入薪資紀錄" };

export default function SalaryImportPage() {
  return <SalaryImportView />;
}
