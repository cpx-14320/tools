"use client";

import type { ReactNode } from "react";
import { LayoutModeProvider, useLayoutMode } from "@/components/layout-mode-context";
import { DateFilterProvider } from "@/components/date-filter-context";
import { ExpensesMobileShell } from "@/components/expenses-mobile-shell";
import { ExpensesDesktopShell } from "@/components/expenses-desktop-shell";

function ExpensesShellInner({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  return mode === "mobile" ? (
    <ExpensesMobileShell>{children}</ExpensesMobileShell>
  ) : (
    <ExpensesDesktopShell>{children}</ExpensesDesktopShell>
  );
}

/** 記帳本工具的外殼：手機／電腦版佈局用按鈕手動切換（跟實際螢幕寬度無關），見
 *  layout-mode-context.tsx。目前預設手機版，工具頁面先以手機版為主設計。 */
export function ExpensesShell({ children }: { children: ReactNode }) {
  return (
    <LayoutModeProvider>
      <DateFilterProvider>
        <ExpensesShellInner>{children}</ExpensesShellInner>
      </DateFilterProvider>
    </LayoutModeProvider>
  );
}
