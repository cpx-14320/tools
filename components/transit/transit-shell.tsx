"use client";

import type { ReactNode } from "react";
import { TransitMobileShell } from "./transit-mobile-shell";

/** 紫彩夢幻風格的獨立外殼，視覺風格完全獨立，不會動到既有頁面的任何樣式——色彩直接寫死在
 *  這個資料夾裡，刻意不動 globals.css 的共用色票。這個工具不管螢幕寬度都固定用手機版樣式，
 *  不提供電腦版切換（跟其他工具共用的 LayoutModeProvider／LayoutToggle 機制脫鉤）。 */
export function TransitShell({ children }: { children: ReactNode }) {
  return <TransitMobileShell>{children}</TransitMobileShell>;
}
