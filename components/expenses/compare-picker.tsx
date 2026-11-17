"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { PillButton } from "./button";
import { useDateFilter } from "./date-filter-context";
import { text } from "./theme";
import { compareDateFilter, compareLabel, shiftYearMonth, type CompareMode } from "@/lib/expenses/date-filter";
import { OptionChip } from "./button";
import { DateField } from "./date-field";

const OPTIONS: { value: CompareMode; label: string; hint: string }[] = [
  { value: "previous", label: "上一期", hint: "月模式比上個月、年模式比去年、日模式比前一天" },
  { value: "lastYear", label: "去年同期", hint: "與去年相同日期範圍比較。" },
  { value: "year", label: "指定年份同期", hint: "挑一個基準年，一直拿它跟現在看的這段比" },
  { value: "custom", label: "自訂年月", hint: "自己挑一個年月，把現在看的這段平移過去比" },
  { value: "none", label: "不比較", hint: "隱藏所有漲跌百分比" },
];

/** 往前列幾年可以當基準年——再早的資料通常也沒在記，列太多只是讓清單變難選。 */
const YEAR_SPAN = 6;

/** 收入／支出／結餘旁邊那個漲跌幅要「跟誰比」。點一下開彈窗選，選完記在共用的
 *  DateFilterProvider 裡，總覽、消費紀錄、帳戶明細三頁一致。只在這次造訪期間共用，
 *  重新整理就回到「不比較」——理由見 date-filter-context.tsx。
 *
 *  跟日期篩選器分開是刻意的：切到別的月份時比較基準不該被重設，不然每看一個月都要
 *  重選一次「跟去年同期比」。 */
export function ComparePicker({ className = "" }: { className?: string }) {
  const { filter, compare, setCompare } = useDateFilter();
  const [open, setOpen] = useState(false);
  const [years] = useState(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: YEAR_SPAN }, (_, i) => thisYear - i);
  });

  // 算不出可比的那一段時（挑到同一年、日期範圍是「全部」）按鈕就寫「不比較」——畫面上
  // 一個漲跌徽章都沒有，按鈕卻寫著「vs 2026 年」，看起來像是比完了全部持平。
  const label = (compareDateFilter(filter, compare) ? compareLabel(filter, compare) : "") || "不比較";
  // 自訂年月的預設值：現在看的這段的上一個月（跟 compareDateFilter 裡的 fallback 同一套）。
  const customYearMonth = compare.yearMonth ?? shiftYearMonth(`${filter.year}-${String(filter.month).padStart(2, "0")}`, -1);

  return (
    <>
      <PillButton onClick={() => setOpen(true)} className={className}>
        <span className="max-w-[112px] truncate">{label}</span>
        <span aria-hidden>▾</span>
      </PillButton>

      <Modal open={open} onClose={() => setOpen(false)} title="比較基準">
        <p className={`${text.muted} leading-relaxed`}>收入／支出／結餘旁邊的漲跌百分比，是拿現在看的這段期間跟下面選的這一段相比。</p>

        {/* 每一列的高度跟內距都一樣（45px、上下各 12px，量過）；頭尾兩列的底色會被外框的
            16px 圓角修掉一角，那是圓角卡片本來就該有的樣子，不是間距不一致。 */}
        <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
          {OPTIONS.map((opt) => {
            const active = compare.mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  // 自訂年月跟指定年份一樣：選了之後彈窗要留著，底下還有一個年月／年份要挑。
                  setCompare({ ...compare, mode: opt.value, yearMonth: opt.value === "custom" ? customYearMonth : compare.yearMonth });
                  if (opt.value !== "year" && opt.value !== "custom") setOpen(false);
                }}
                className={`px-4 py-3 text-left ${active ? "bg-[#F9F7FE]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${active ? "text-[#6F5FD6]" : "text-[#4A3B7C]"}`}>{opt.label}</span>
                  {active && <span className="text-xs font-semibold text-[#6F5FD6]">使用中</span>}
                </div>
                <p className={`mt-0.5 ${text.faint}`}>{opt.hint}</p>
              </button>
            );
          })}
        </div>

        {compare.mode === "year" && (
          <div>
            <p className={`mb-2 ${text.label}`}>基準年</p>
            {/* 跟「選擇年份」彈窗同一顆 OptionChip、同樣固定六欄：年份都是四位數、寬度
                一樣，grid 才會每列剛好六個、首尾切齊彈窗左右邊界、中間等距。flex-wrap 是
                「排得下就繼續排」，最後一列會短一截、左右也切不齊。 */}
            <div className="grid grid-cols-6 gap-2">
              {years.map((y) => (
                <OptionChip
                  key={y}
                  active={compare.year === y}
                  onClick={() => {
                    setCompare({ mode: "year", year: y });
                    setOpen(false);
                  }}
                >
                  {y}
                </OptionChip>
              ))}
            </div>
            {/* 基準年跟現在看的年份一樣時沒東西可比，講清楚比讓百分比默默消失好。 */}
            {compare.year === filter.year && <p className={`mt-2 ${text.faint}`}>基準年就是現在看的年份，這樣沒有東西可以比，換一年看看。</p>}
          </div>
        )}

        {/* 自訂年月：挑「平移到哪個年月」，不是挑一段起訖。區間長度跟著現在看的那段走，
            兩邊的天數才一樣多——看近三個月時挑 2024/03，比的是 2023/12～2024/03 那三個月
            （見 date-filter.ts 的 shiftFilterToYearMonth）。 */}
        {compare.mode === "custom" && (
          <div>
            <p className={`mb-2 ${text.label}`}>平移到哪個年月</p>
            <DateField
              value={customYearMonth}
              granularity="month"
              onChange={(yearMonth) => {
                setCompare({ ...compare, mode: "custom", yearMonth });
                setOpen(false);
              }}
            />
            <p className={`mt-2 ${text.faint}`}>
              {filter.mode === "year"
                ? customYearMonth.slice(0, 4) === String(filter.year)
                  ? "現在看的是整年，挑同一年等於跟自己比，換一年看看。"
                  : "現在看的是整年，所以只會用到你挑的那一年，月份不影響。"
                : "現在看的這段期間有多長，平移過去的那段就一樣長。"}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
