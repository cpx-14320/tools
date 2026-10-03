"use client";

import type { ReactNode } from "react";
import { LayoutToggle } from "@/components/layout-toggle";

/** 工具選單首頁的電腦版外殼：跟記帳本工具一樣固定 1440px 寬，但沒有側邊欄——
 *  選單本身沒有子導覽項目，一個置頂的品牌列＋切換鈕就夠了。 */
export function HubDesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[1440px] px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <p className="text-lg font-bold tracking-tight">🧰 cpx-tools</p>
        <LayoutToggle />
      </header>
      <main>{children}</main>
    </div>
  );
}
