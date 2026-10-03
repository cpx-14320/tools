"use client";

import type { ReactNode } from "react";
import { LayoutModeProvider, useLayoutMode } from "@/components/layout-mode-context";
import { HubMobileShell } from "@/components/hub-mobile-shell";
import { HubDesktopShell } from "@/components/hub-desktop-shell";

function HubShellInner({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  return mode === "mobile" ? <HubMobileShell>{children}</HubMobileShell> : <HubDesktopShell>{children}</HubDesktopShell>;
}

/** 工具選單首頁的外殼：跟記帳本工具共用同一套手機／電腦版切換機制（layout-mode-context.tsx），
 *  localStorage key 也相同，所以在首頁切好之後，點進任一工具會維持同一個選擇。 */
export function HubShell({ children }: { children: ReactNode }) {
  return (
    <LayoutModeProvider>
      <HubShellInner>{children}</HubShellInner>
    </LayoutModeProvider>
  );
}
