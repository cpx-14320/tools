"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { defaultDateFilter, type DateFilter, type DateFilterMode } from "@/lib/expenses/mock-data";

const STORAGE_KEY = "cpx-tools:expenses-date-filter";

const DateFilterContext = createContext<{
  filter: DateFilter;
  setFilter: (f: DateFilter) => void;
  setMode: (mode: DateFilterMode) => void;
} | null>(null);

function loadSaved(): DateFilter | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.mode === "string") return parsed as DateFilter;
  } catch {
    /* 私密視窗等情況或資料壞掉，忽略，用預設值 */
  }
  return null;
}

/** 總覽／消費紀錄／薪資紀錄共用同一個日期篩選器（年／月／日／全部／自訂），切一次三頁都跟著換。
 *  用 useState 的 lazy initializer 讀 localStorage，比 useEffect+setState 省一次重新算繪，
 *  也不會有畫面先閃預設值、再跳成上次選擇的問題（這個 context 本身就是 client-only）。 */
export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<DateFilter>(() => loadSaved() ?? defaultDateFilter());

  function setFilter(f: DateFilter) {
    setFilterState(f);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {
      /* 忽略 */
    }
  }

  function setMode(mode: DateFilterMode) {
    setFilter({ ...filter, mode });
  }

  return <DateFilterContext.Provider value={{ filter, setFilter, setMode }}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}
