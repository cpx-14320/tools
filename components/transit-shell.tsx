"use client";

import type { ReactNode } from "react";
import { LayoutModeProvider, useLayoutMode } from "@/components/layout-mode-context";
import { TransitMobileShell } from "@/components/transit-mobile-shell";
import { TransitDesktopShell } from "@/components/transit-desktop-shell";

function TransitShellInner({ children }: { children: ReactNode }) {
  const { mode } = useLayoutMode();
  return mode === "mobile" ? <TransitMobileShell>{children}</TransitMobileShell> : <TransitDesktopShell>{children}</TransitDesktopShell>;
}

/** 搭乘車查詢工具的外殼：跟記帳本共用同一套手機／電腦版切換機制（layout-mode-context.tsx），
 *  localStorage key 也相同，所以切好之後跨工具都會維持同一個選擇。目前預設手機版。 */
export function TransitShell({ children }: { children: ReactNode }) {
  return (
    <LayoutModeProvider>
      <TransitShellInner>{children}</TransitShellInner>
    </LayoutModeProvider>
  );
}
