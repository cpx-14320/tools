"use client";

import type { ReactNode } from "react";
import { DateFilterProvider } from "@/components/expenses/date-filter-context";
import { ExpensesMobileShell } from "@/components/expenses/expenses-mobile-shell";

/** 記帳本工具的外殼。只有手機版版面——記帳本整套畫面（底部導覽列、浮動新增按鈕、
 *  底部彈出的彈窗）都是照手機操作設計的，原本那個切到電腦版的按鈕只會把同一批元件
 *  塞進一個側邊欄版面，兩邊維護成本翻倍、實際上也沒在用，所以連同電腦版外殼一起移除。
 *  （共用的 LayoutModeProvider 還在，hub 跟搭乘車仍然有自己的電腦版。） */
export function ExpensesShell({ children }: { children: ReactNode }) {
  return (
    <DateFilterProvider>
      <ExpensesMobileShell>{children}</ExpensesMobileShell>
    </DateFilterProvider>
  );
}
