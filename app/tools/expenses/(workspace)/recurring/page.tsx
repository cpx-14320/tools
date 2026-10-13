import type { Metadata } from "next";
import { RecurringView } from "./recurring-view";

export const metadata: Metadata = { title: "固定收支" };

export default function RecurringPage() {
  return <RecurringView />;
}
