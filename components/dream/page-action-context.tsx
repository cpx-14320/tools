"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface PageAction {
  label: string;
  onClick: () => void;
}

interface PageActionValue {
  action: PageAction | null;
  setAction: (action: PageAction | null) => void;
}

const PageActionContext = createContext<PageActionValue | null>(null);

/** 讓個別頁面（例如首頁）可以在外殼（mobile/desktop shell）的電腦版/手機版切換鈕旁邊
 *  插入自己的按鈕，而不用把按鈕邏輯寫進共用外殼——頁面掛載時註冊、卸載時自動清掉，
 *  離開該頁按鈕就會跟著消失，不會影響其他頁面。 */
export function PageActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<PageAction | null>(null);
  return <PageActionContext.Provider value={{ action, setAction }}>{children}</PageActionContext.Provider>;
}

export function usePageAction() {
  const ctx = useContext(PageActionContext);
  if (!ctx) throw new Error("usePageAction 必須在 PageActionProvider 底下使用");
  return ctx;
}
