"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LayoutMode = "mobile" | "desktop";

const STORAGE_KEY = "cpx-tools:layout-mode";

const LayoutModeContext = createContext<{
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
} | null>(null);

/** 手機／電腦版佈局切換：跟實際螢幕寬度無關，是手動切換，存在 localStorage 記住選擇。
 *  預設 "mobile"——工具頁面目前以手機版佈局為主，桌面版之後再慢慢補。 */
export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>("mobile");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // 讀 localStorage 這種外部系統只能在掛載後做，故意只在這裡設定一次初始值，不是算繪迴圈。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "mobile" || saved === "desktop") setModeState(saved);
    } catch {
      /* 私密視窗等情況忽略，用預設值 */
    }
    setReady(true);
  }, []);

  function setMode(m: LayoutMode) {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* 忽略 */
    }
  }

  // 還沒讀完 localStorage 前先不渲染，避免畫面先閃一下預設值再跳成使用者上次選的模式。
  if (!ready) return null;

  return <LayoutModeContext.Provider value={{ mode, setMode }}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used inside LayoutModeProvider");
  return ctx;
}
