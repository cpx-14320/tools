"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  defaultCompareSetting,
  defaultDateFilter,
  type CompareSetting,
  type DateFilter,
  type DateFilterMode,
} from "@/lib/expenses/date-filter";

const STORAGE_KEY = "cpx-tools:expenses-date-filter";
const COMPARE_STORAGE_KEY = "cpx-tools:expenses-compare";

const DateFilterContext = createContext<{
  filter: DateFilter;
  setFilter: (f: DateFilter) => void;
  setMode: (mode: DateFilterMode) => void;
  /** 「跟哪一段比」——跟 filter 分開存，切換看的月份時不會把比較基準也重設掉。 */
  compare: CompareSetting;
  setCompare: (c: CompareSetting) => void;
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

function loadSavedCompare(): CompareSetting | null {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.mode === "string" && typeof parsed.year === "number") {
      return parsed as CompareSetting;
    }
  } catch {
    /* 同上 */
  }
  return null;
}

/** 總覽／消費紀錄／薪資紀錄共用同一個日期篩選器（年／月／日／全部／自訂），切一次三頁都跟著換。
 *
 *  初始值一定是預設值，localStorage 要等掛載後才讀：這個 Provider 雖然是 client component，
 *  但 Next.js 在伺服器端一樣會先算繪一次，而伺服器沒有 localStorage。之前是在 useState 的
 *  lazy initializer 裡讀，等於伺服器端算出「本月」、瀏覽器第一次算繪卻是上次存的「自訂」，
 *  兩邊 HTML 對不起來就會 hydration 失敗（React 會整棵子樹重畫，主控台也會噴錯）。 */
export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<DateFilter>(defaultDateFilter);
  const [compare, setCompareState] = useState<CompareSetting>(defaultCompareSetting);

  // 已經有人主動設定過就不要再用 localStorage 蓋回去。子元件的掛載 effect 會比這裡的先跑
  // （React 的 effect 由內而外），例如消費紀錄頁會依網址的 ?month= 指定月份——那是比
  // 「上次用的篩選」更明確的意圖，不該被記憶值蓋掉。
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    const saved = loadSaved();
    const savedCompare = loadSavedCompare();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) setFilterState(saved);
    if (savedCompare) setCompareState(savedCompare);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setFilter(f: DateFilter) {
    touched.current = true;
    setFilterState(f);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {
      /* 忽略 */
    }
  }

  function setCompare(c: CompareSetting) {
    touched.current = true;
    setCompareState(c);
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(c));
    } catch {
      /* 忽略 */
    }
  }

  function setMode(mode: DateFilterMode) {
    setFilter({ ...filter, mode });
  }

  return <DateFilterContext.Provider value={{ filter, setFilter, setMode, compare, setCompare }}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}
