import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExpensesShell } from "@/components/expenses/expenses-shell";

export const metadata: Metadata = { title: "記帳本" };

export default function ExpensesLayout({ children }: { children: ReactNode }) {
  return <ExpensesShell>{children}</ExpensesShell>;
}
