"use client";

import { useSearchParams } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { defaultCompareSetting, defaultDateFilter, type CompareSetting, type DateFilter } from "@/lib/expenses/date-filter";
import { isValidYearMonth } from "@/lib/expenses/budgets";

const DateFilterContext = createContext<{
  filter: DateFilter;
  setFilter: (f: DateFilter) => void;
  /** 「跟哪一段比」——跟 filter 分開存，切換看的月份時不會把比較基準也重設掉。 */
  compare: CompareSetting;
  setCompare: (c: CompareSetting) => void;
} | null>(null);

/** 報表／消費紀錄／帳戶明細共用同一個日期篩選器跟比較基準，切一次幾頁都跟著換。
 *
 *  兩個都只在這次造訪期間共用，不跨重新整理記憶：
 *
 *  - 日期：每次重新打開記帳本都從「當月」開始。記帳本問的是「我這個月花得怎麼樣」，
 *    上次臨時切去看 2025/03 或「全部」之後就一直停在那裡的話，下次打開看到的數字不是
 *    當下的狀況，很容易誤判。要回去看別的月份，日期膠囊隨時能切。
 *  - 比較基準：每次重新打開都回到「不比較」。「跟上一期比」是看報表時臨時起意的一個
 *    動作，不是一種長期偏好——記著的話，下次只是想看這個月花多少，畫面上卻又自己冒出
 *    一排 ▲／▼，而且看不出那是上次留下來的設定。要比就按標題旁邊那顆按鈕。
 *
 *  （這裡刻意完全不碰 localStorage：之前比較基準是記起來的，結果就是「改了預設值卻對
 *  已經選過的人沒效果」這種說不清楚的狀態。）
 *
 *  網址上的 ?month=YYYY-MM 是例外，而且刻意在這裡讀、不在用到篩選器的那一頁讀：首頁的
 *  預算卡／收入來源「查看全部」會帶這個參數過去，把篩選器切到跟卡片同一個月，不然首頁
 *  顯示的是 10 月、進去卻停在當月，兩邊數字對不起來。
 *
 *  本來是消費紀錄頁在 useEffect 裡 setFilter，但那是**算繪完才跑**的：伺服器先吐出當月
 *  （11 月）的畫面，瀏覽器接手後才切成 10 月，使用者會實際看到數字閃一次。在這裡當成
 *  useState 的初始值讀，伺服器那一輪就已經是 10 月，從頭到尾只有一個畫面。 */
export function DateFilterProvider({ children }: { children: ReactNode }) {
  const requestedMonth = useSearchParams().get("month") ?? "";
  const [filter, setFilter] = useState<DateFilter>(() => {
    if (!isValidYearMonth(requestedMonth)) return defaultDateFilter();
    const [year, month] = requestedMonth.split("-").map(Number);
    return { ...defaultDateFilter(), mode: "month", year, month };
  });
  const [compare, setCompare] = useState<CompareSetting>(defaultCompareSetting);

  return <DateFilterContext.Provider value={{ filter, setFilter, compare, setCompare }}>{children}</DateFilterContext.Provider>;
}

export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}
