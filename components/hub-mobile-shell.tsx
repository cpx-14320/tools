"use client";

import type { ReactNode } from "react";
import { LayoutToggle } from "@/components/layout-toggle";
import { AuthStatus } from "@/components/auth-status";

/** 工具選單首頁的手機版外殼：跟記帳本工具同一套手機外觀（固定 430px、置中、桌面瀏覽器下
 *  會多一圈邊框變成「手機外觀」），但這裡還不需要底部分頁——選單本身就是最上層，沒有子頁面要切。 */
export function HubMobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center bg-surface-2 px-0 py-0 sm:px-4 sm:py-6">
      <div className="flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-bg sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-surface sm:shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <p className="text-lg font-bold tracking-tight">🧰 cpx-tools</p>
          <div className="flex items-center gap-2">
            <AuthStatus />
            <LayoutToggle />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</main>
      </div>
    </div>
  );
}
