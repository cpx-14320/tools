"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TransitMobileNav } from "@/components/transit-mobile-nav";
import { LayoutToggle } from "@/components/layout-toggle";

const titles: Record<string, string> = {
  "/tools/transit": "總覽",
  "/tools/transit/routes": "監控路線",
  "/tools/transit/routes/new": "新增監控路線",
  "/tools/transit/timetable": "時刻表查詢",
  "/tools/transit/notify": "通知設定",
};

export function TransitMobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = titles[pathname] ?? "搭乘車查詢";

  return (
    <div className="flex justify-center bg-surface-2 px-0 py-0 sm:px-4 sm:py-6">
      <div className="flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-bg sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-surface sm:shadow-xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">🚌 搭乘車查詢</p>
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
          </div>
          <LayoutToggle />
        </header>

        {/* 導覽列改成 fixed（不佔版面流動空間），這裡要補 padding-bottom 留出同等高度，內容才不會被蓋住。 */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>

        <TransitMobileNav />
      </div>
    </div>
  );
}
