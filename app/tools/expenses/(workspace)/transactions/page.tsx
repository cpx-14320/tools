import type { Metadata } from "next";
import { TransactionsView } from "./transactions-view";

export const metadata: Metadata = { title: "消費紀錄" };

export default function TransactionsPage() {
  return <TransactionsView />;
}
