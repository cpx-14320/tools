"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ExpensesMobileNav } from "@/components/expenses/expenses-mobile-nav";

/** 記帳本手機版外殼——視覺上參考搭乘車的 TransitMobileShell（固定高度卡片、內容區自己
 *  捲動、漸層底、底部導覽列同一套樣式），但是獨立檔案、獨立元件，不共用搭乘車那邊的
 *  元件。電腦版之後會是記帳本自己另外設計的版面（見 ExpensesDesktopShell），不是像
 *  搭乘車那樣只靠同一份手機版縮小呈現，所以這裡的寬螢幕樣式只是「手機版在寬螢幕上的
 *  外觀」，不是電腦版本身。
 *
 *  不放固定的頂部 header——每個頁面本身的 PageHeader 已經有標題，疊一層外殼 header
 *  只會重複顯示同一個標題。也沒有切換電腦版的按鈕：記帳本只有手機版版面（見
 *  ExpensesShell）。 */
export function ExpensesMobileShell({ children }: { children: ReactNode }) {
  // 養成頁整頁就是一張遊戲畫面（場地圖要貼到四個邊、狀態列跟按鈕都疊在圖上），所以那一頁
  // 不吃這層的左右／上下留白。判斷寫在這裡而不是讓頁面自己用負的 margin 去抵銷：負 margin
  // 要跟這裡的數字永遠對得上，改一邊忘了另一邊就會露出一條縫。
  const fullBleed = usePathname() === "/tools/expenses/pet";

  return (
    <div className="flex justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        // h-dvh（不是 min-h-screen）：卡片本身要有固定、確定的高度，main 才能用
        // overflow-y-auto 在卡片「內部」自己捲動，不會被內容撐到比螢幕還高、連帶讓
        // sticky／回頂部按鈕失效——這正是原本 min-h-screen 版本的問題，跟搭乘車
        // TransitMobileShell 當初修正的理由一樣，這裡直接比照辦理。
        // max-h-dvh：視窗比 850px 矮時（筆電），卡片會長到畫面外、底部導覽列整排看不到。
        className="relative flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden sm:h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)", transform: "translateZ(0)" }}
      >
        {/* main 本身的間距比照搭乘車 TransitMobileShell 那份（min-h-0 flex-1 overflow-y-auto
            pb-24，見 transit-mobile-shell.tsx）——pb-24 留給底部導覽列（fixed、不佔版面流動
            空間），左右／上下留白搬進內層這個 div，main 本身保持跟搭乘車一致、不吃 padding。 */}
        {/* fullBleed 的頁面連 pb-24 都不留：那段留白本來是讓內容不要被底部導覽列蓋住，
            但養成頁的場地圖要一路鋪到卡片底下（導覽列是不透明的白色橫列，圖鋪到它底下
            不會被看到半截），留著的話場地跟導覽列中間會露出一條紫色漸層。那一頁改成自己
            把下緣的按鈕墊高（見 pet-view.tsx 的 bottom-24）。 */}
        <main className={`min-h-0 flex-1 overflow-y-auto ${fullBleed ? "" : "pb-24"}`}>
          {/* min-h-full：讓頁面至少佔滿捲動區的高度，內容不夠長時底下才不會露出外殼的
              紫色漸層。首頁的主視覺版型（HeroShell）靠這個讓白色面板撐到底。 */}
          <div className={`flex min-h-full flex-col ${fullBleed ? "" : "px-5 pb-6 pt-6"}`}>{children}</div>
        </main>

        <ExpensesMobileNav />
      </div>
    </div>
  );
}
