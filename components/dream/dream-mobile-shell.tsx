"use client";

import type { ReactNode } from "react";
import { LayoutToggle } from "@/components/layout-toggle";
import { DreamMobileNav } from "./dream-mobile-nav";
import { usePageAction } from "./page-action-context";

export function DreamMobileShell({ children }: { children: ReactNode }) {
  const { action } = usePageAction();

  return (
    <div className="flex justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        className="relative flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)" }}
      >
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <LayoutToggle className="bg-white/80 backdrop-blur" />
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ECE4FA] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6F5FD6] shadow-sm backdrop-blur"
            >
              {action.label}
            </button>
          )}
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

        <DreamMobileNav />
      </div>
    </div>
  );
}
