import type { Metadata } from "next";
import { SalaryView } from "./salary-view";

export const metadata: Metadata = { title: "薪資紀錄" };

export default function SalaryPage() {
  return <SalaryView />;
}
