"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  defaultCompareSetting,
  defaultDateFilter,
  type CompareSetting,
  type DateFilter,
} from "@/lib/expenses/date-filter";

const COMPARE_STORAGE_KEY = "cpx-tools:expenses-compare";

const DateFilterContext = createContext<{
  filter: DateFilter;
  setFilter: (f: DateFilter) => void;
  /** 「跟哪一段比」——跟 filter 分開存，切換看的月份時不會把比較基準也重設掉。 */
  compare: CompareSetting;
  setCompare: (c: CompareSetting) => void;
} | null>(null);

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
 *  只在這次造訪期間共用，不跨重新整理記憶：每次重新打開記帳本都從「當月」開始。記帳本的
 *  首頁問的是「我這個月花得怎麼樣」，上次臨時切去看 2025/03 或「全部」之後就一直停在那裡，
 *  下次打開看到的數字不是當下的狀況，很容易誤判。要回去看別的月份，左上角的日期隨時能切，
 *  切完同一次造訪裡的紀錄頁、報表頁都會跟著走。
 *
 *  （「跟誰比」的 compare 則相反，那是一種偏好設定、跟看哪個月無關，所以照樣記在
 *  localStorage 裡。）
 *
 *  compare 的初始值一定是預設值，localStorage 要等掛載後才讀：這個 Provider 雖然是 client
 *  component，但 Next.js 在伺服器端一樣會先算繪一次，而伺服器沒有 localStorage。之前是在
 *  useState 的 lazy initializer 裡讀，等於兩邊算出來的 HTML 對不起來，hydration 會失敗。 */
export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<DateFilter>(defaultDateFilter);
  const [compare, setCompareState] = useState<CompareSetting>(defaultCompareSetting);

  // 已經有人主動設定過就不要再用 localStorage 蓋回去。子元件的掛載 effect 會比這裡的先跑
  // （React 的 effect 由內而外），例如消費紀錄頁會依網址的 ?month= 指定月份——那是比
  // 記憶值更明確的意圖，不該被蓋掉。
  const touched = useRef(false);

  useEffect(() => {
    if (touched.current) return;
    const savedCompare = loadSavedCompare();
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (savedCompare) setCompareState(savedCompare);
  }, []);

  function setFilter(f: DateFilter) {
    touched.current = true;
    setFilterState(f);
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

  return <DateFilterContext.Provider value={{ filter, setFilter, compare, setCompare }}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}
