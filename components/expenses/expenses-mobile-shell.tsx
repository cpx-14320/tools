"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ExpensesMobileNav } from "@/components/expenses/expenses-mobile-nav";
import { LayoutToggle } from "@/components/layout-toggle";

const titles: Record<string, string> = {
  "/tools/expenses": "總覽",
  "/tools/expenses/transactions": "紀錄",
  "/tools/expenses/categories": "消費分類",
  "/tools/expenses/goals": "存錢目標",
  "/tools/expenses/recurring": "固定收支",
  "/tools/expenses/assets": "資產總表",
  "/tools/expenses/reports": "報表",
  "/tools/expenses/more": "更多",
};

// 色系／按鈕顏色直接比照搭乘車的實際色碼（主紫 #6F5FD6、淡紫底、#4A3B7C／#9C94C4 文字
// 兩階），不是另外調整過的一套——這裡是獨立檔案、不 import 搭乘車的元件，但色碼刻意跟
// 搭乘車一致。
const INK_STRONG = "#4A3B7C";
const INK_MUTED = "#9C94C4";
const BORDER = "#ECE4FA";

/** 記帳本手機版外殼——視覺上參考搭乘車的 TransitMobileShell（固定高度卡片、內容區自己
 *  捲動、漸層底、底部導覽列同一套樣式），但是獨立檔案、獨立元件，不共用搭乘車那邊的
 *  元件。電腦版之後會是記帳本自己另外設計的版面（見 ExpensesDesktopShell），不是像
 *  搭乘車那樣只靠同一份手機版縮小呈現，所以這裡的寬螢幕樣式只是「手機版在寬螢幕上的
 *  外觀」，不是電腦版本身。 */
export function ExpensesMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "記帳本";

  return (
    <div className="flex justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        // h-dvh（不是 min-h-screen）：卡片本身要有固定、確定的高度，main 才能用
        // overflow-y-auto 在卡片「內部」自己捲動，不會被內容撐到比螢幕還高、連帶讓
        // sticky／回頂部按鈕失效——這正是原本 min-h-screen 版本的問題，跟搭乘車
        // TransitMobileShell 當初修正的理由一樣，這裡直接比照辦理。
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden sm:h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)", transform: "translateZ(0)" }}
      >
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 px-4 py-3 backdrop-blur"
          style={{ borderColor: BORDER }}
        >
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: INK_MUTED }}>
              📒 記帳本
            </p>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: INK_STRONG }}>
              {title}
            </h1>
          </div>
          <LayoutToggle className="border-[#ECE4FA] bg-white text-[#4A3B7C] shadow-none hover:text-[#6F5FD6]" />
        </header>

        {/* 導覽列是 fixed（不佔版面流動空間），這裡要補 padding-bottom 留出同等高度，內容才不會被蓋住。 */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>

        <ExpensesMobileNav />
      </div>
    </div>
  );
}
