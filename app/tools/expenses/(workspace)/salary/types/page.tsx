import type { Metadata } from "next";
import { SalaryTypesView } from "./salary-types-view";

export const metadata: Metadata = { title: "薪資明細類型" };

export default function SalaryTypesPage() {
  return <SalaryTypesView />;
}
