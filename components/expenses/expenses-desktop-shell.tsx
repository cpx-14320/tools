import Link from "next/link";
import type { ReactNode } from "react";
import { ledger } from "@/lib/expenses/mock-data";
import { ExpensesNav } from "@/components/expenses/expenses-nav";
import { LayoutToggle } from "@/components/layout-toggle";

export function ExpensesDesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-[1440px] gap-8 px-6 py-8">
      <aside className="sticky top-8 h-fit w-56 shrink-0 self-start">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs font-medium text-muted hover:text-ink">
            ← cpx-tools
          </Link>
          <LayoutToggle />
        </div>
        <p className="mt-2 text-sm font-semibold">📒 {ledger.name}</p>
        <ExpensesNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
