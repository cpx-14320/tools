"use client";

import type { ReactNode } from "react";
import { LayoutModeProvider, useLayoutMode } from "@/components/layout-mode-context";
import { PageActionProvider } from "./page-action-context";
import { DreamMobileShell } from "./dream-mobile-shell";
import { DreamDesktopShell } from "./dream-desktop-shell";

function DreamShellInner({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  return mode === "mobile" ? <DreamMobileShell>{children}</DreamMobileShell> : <DreamDesktopShell>{children}</DreamDesktopShell>;
}

/** 紫彩夢幻風格的獨立外殼，跟其他工具共用同一套手機／電腦版切換機制，但視覺風格完全獨立，
 *  不會動到既有頁面的任何樣式——色彩直接寫死在這個資料夾裡，刻意不動 globals.css 的共用色票。 */
export function DreamShell({ children }: { children: ReactNode }) {
  return (
    <LayoutModeProvider>
      <PageActionProvider>
        <DreamShellInner>{children}</DreamShellInner>
      </PageActionProvider>
    </LayoutModeProvider>
  );
}
