"use client";

import type { ReactNode } from "react";
import { DreamMobileNav } from "./dream-mobile-nav";
import { usePageAction } from "./page-action-context";

/** 這個工具不提供電腦版、沒有切換鈕——但寬螢幕瀏覽時仍然維持「手機外觀」：置中、固定最大
 *  寬度、圓角＋邊框，看起來像個小手機框，不會因為視窗變寬就整頁撐滿。 */
export function DreamMobileShell({ children }: { children: ReactNode }) {
  const { action } = usePageAction();

  return (
    <div className="flex justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        className="relative flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)" }}
      >
        {action && (
          <div className="absolute right-4 top-4 z-20">
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ECE4FA] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6F5FD6] shadow-sm backdrop-blur"
            >
              {action.label}
            </button>
          </div>
        )}

        {/* 導覽列只在窄螢幕（真手機）是 fixed 的，這裡補 padding-bottom 留出同等高度避免蓋住內容；
            sm: 以上導覽列回到一般排列、本來就會自己佔位，不需要這段留白。 */}
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 sm:pb-0">{children}</main>

        <DreamMobileNav />
      </div>
    </div>
  );
}
