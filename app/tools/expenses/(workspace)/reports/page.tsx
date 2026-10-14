import type { Metadata } from "next";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "報表" };

export default function ReportsPage() {
  return <ReportsView />;
}
