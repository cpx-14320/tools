import type { Metadata } from "next";
import { BudgetsView } from "./budgets-view";

export const metadata: Metadata = { title: "預算設定" };

export default function BudgetsPage() {
  return <BudgetsView />;
}
