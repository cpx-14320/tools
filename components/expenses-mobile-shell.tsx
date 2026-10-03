"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import type { ReactNode } from "react";
import { ledger } from "@/lib/mock-data";
import { ExpensesMobileNav } from "@/components/expenses-mobile-nav";
import { LayoutToggle } from "@/components/layout-toggle";
import { scrollContainerToTop } from "@/lib/scroll-within";

const titles: Record<string, string> = {
  "/tools/expenses": "總覽",
  "/tools/expenses/transactions": "消費紀錄",
  "/tools/expenses/categories": "消費分類",
  "/tools/expenses/salary": "薪資紀錄",
  "/tools/expenses/salary/types": "薪資明細類型",
  "/tools/expenses/members": "成員",
  "/tools/expenses/reports": "報表",
  "/tools/expenses/more": "更多",
};

export function ExpensesMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "記帳本";
  const mainRef = useRef<HTMLElement | null>(null);

  return (
    <div className="flex justify-center bg-surface-2 px-0 py-0 sm:px-4 sm:py-6">
      <div className="flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-bg sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-surface sm:shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">📒 {ledger.name}</p>
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          </div>
          <LayoutToggle />
        </header>

        {/* 導覽列是 fixed（不佔版面流動空間），這裡要補 padding-bottom 留出同等高度，內容才不會被蓋住。 */}
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">
          {children}
        </main>

        <button
          type="button"
          onClick={() => mainRef.current && scrollContainerToTop(mainRef.current)}
          aria-label="回到頂部"
          // 用 inline style 設定 bottom：這個專案目前 Tailwind 沒有產生 bottom-* 這類 inset 工具類別
          // （right-6／pb-24 都有產生，唯獨 bottom-* 缺漏，原因不明），直接寫 style 比較保險。
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
          className="fixed right-6 z-20 grid size-11 place-items-center rounded-full bg-brand text-brand-fg shadow-lg transition-opacity hover:opacity-90"
        >
          ↑
        </button>

        <ExpensesMobileNav />
      </div>
    </div>
  );
}
