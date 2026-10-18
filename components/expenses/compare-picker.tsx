"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { useDateFilter } from "./date-filter-context";
import { text } from "./theme";
import { compareLabel, type CompareMode } from "@/lib/expenses/date-filter";

const OPTIONS: { value: CompareMode; label: string; hint: string }[] = [
  { value: "previous", label: "上一期", hint: "月模式比上個月、年模式比去年、日模式比前一天" },
  { value: "lastYear", label: "去年同期", hint: "看的是 2026 年 10 月就比 2025 年 10 月" },
  { value: "year", label: "指定年份同期", hint: "挑一個基準年，一直拿它跟現在看的這段比" },
  { value: "none", label: "不比較", hint: "隱藏所有漲跌百分比" },
];

/** 往前列幾年可以當基準年——再早的資料通常也沒在記，列太多只是讓清單變難選。 */
const YEAR_SPAN = 6;

/** 收入／支出／結餘旁邊那個漲跌幅要「跟誰比」。點一下開彈窗選，選完記在共用的
 *  DateFilterProvider 裡（會存進 localStorage），總覽、消費紀錄、帳戶明細三頁一致。
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

  const label = compareLabel(filter, compare) || "不比較";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex shrink-0 items-center gap-1 rounded-full border border-[#ECE4FA] bg-white px-3 py-1.5 text-xs font-medium text-[#6F5FD6] ${className}`}
      >
        <span>{label}</span>
        <span aria-hidden className="text-[#C7BFE6]">
          ▾
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="比較基準">
        <p className={`${text.muted} leading-relaxed`}>收入／支出／結餘旁邊的漲跌百分比，是拿現在看的這段期間跟下面選的這一段相比。</p>

        <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
          {OPTIONS.map((opt) => {
            const active = compare.mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setCompare({ ...compare, mode: opt.value });
                  if (opt.value !== "year") setOpen(false);
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
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setCompare({ mode: "year", year: y });
                    setOpen(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                    compare.year === y ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            {/* 基準年跟現在看的年份一樣時沒東西可比，講清楚比讓百分比默默消失好。 */}
            {compare.year === filter.year && <p className={`mt-2 ${text.faint}`}>基準年就是現在看的年份，這樣沒有東西可以比，換一年看看。</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
