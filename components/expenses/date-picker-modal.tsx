"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 該月 1 號是星期幾（0=日...6=六），用來算月曆格子前面要留幾個空白。
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function parseValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) ? m : now.getMonth() + 1,
    day: Number.isFinite(d) ? d : now.getDate(),
  };
}

export type DateGranularity = "day" | "month";

/** 記帳本共用日期／月份選擇器，比照搭乘車 components/transit/date-picker-modal.tsx 的
 *  行事曆格子＋手動輸入切換（日期模式）；月份模式是這裡額外做的，把日期格換成 12 個
 *  月份格、用年份切換，給薪資紀錄的月份欄、匯出頁的起訖月份用，不需要手動輸入模式
 *  （格子本來就只有 12 個，已經夠快選）。 */
export function DatePickerModal({
  open,
  granularity = "day",
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  granularity?: DateGranularity;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const parsed = parseValue(initial);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [viewMode, setViewMode] = useState<"calendar" | "manual">("calendar");

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const totalDays = daysInMonth(year, month);
  const leadingBlanks = firstWeekday(year, month);
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function changeMonth(delta: number) {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setYear(nextYear);
    setMonth(nextMonth);
    setDay((d) => Math.min(d, daysInMonth(nextYear, nextMonth)));
  }

  function setManualMonth(v: number) {
    const m = Math.min(12, Math.max(1, v));
    setMonth(m);
    setDay((d) => Math.min(d, daysInMonth(year, m)));
  }

  function handleConfirm() {
    onSave(granularity === "month" ? `${year}-${pad2(month)}` : `${year}-${pad2(month)}-${pad2(day)}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={granularity === "month" ? "選擇月份" : "選擇日期"}
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleConfirm}>確定</Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        {granularity === "month" ? (
          <>
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label="上一年"
                className="grid size-8 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
              >
                ‹
              </button>
              <p className="text-base font-semibold text-[#4A3B7C]">{year} 年</p>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                aria-label="下一年"
                className="grid size-8 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
              >
                ›
              </button>
            </div>
            <div className="grid w-full grid-cols-4 gap-2">
              {MONTHS.map((label, i) => {
                const m = i + 1;
                const isSelected = m === month;
                const isCurrent = year === now.getFullYear() && m === now.getMonth() + 1;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonth(m)}
                    className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      isSelected ? "bg-[#6F5FD6] text-white" : isCurrent ? "bg-[#EFEAFC] text-[#6F5FD6]" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        ) : viewMode === "calendar" ? (
          <>
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="上個月"
                className="grid size-8 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
              >
                ‹
              </button>
              <p className="text-base font-semibold text-[#4A3B7C]">
                {year}年{month}月
              </p>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="下個月"
                className="grid size-8 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
              >
                ›
              </button>
            </div>

            <div className="grid w-full grid-cols-7 gap-y-1.5">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-center text-xs font-medium text-[#B3ABD4]">
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <span key={`blank-${i}`} />;
                const isSelected = d === day;
                const isToday = `${year}-${pad2(month)}-${pad2(d)}` === todayStr;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    className={`mx-auto grid size-9 place-items-center rounded-full text-sm font-medium transition-colors ${
                      isSelected ? "bg-[#6F5FD6] text-white" : isToday ? "bg-[#EFEAFC] text-[#6F5FD6]" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-6">
            <input
              type="number"
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setYear(v);
              }}
              className="w-20 rounded-2xl border border-[#ECE4FA] px-2 py-2 text-center text-lg font-semibold text-[#4A3B7C] outline-none"
            />
            <span className="text-sm text-[#9C94C4]">年</span>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setManualMonth(v);
              }}
              className="w-14 rounded-2xl border border-[#ECE4FA] px-2 py-2 text-center text-lg font-semibold text-[#4A3B7C] outline-none"
            />
            <span className="text-sm text-[#9C94C4]">月</span>
            <input
              type="number"
              min={1}
              max={daysInMonth(year, month)}
              value={day}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setDay(Math.min(daysInMonth(year, month), Math.max(1, v)));
              }}
              className="w-14 rounded-2xl border border-[#ECE4FA] px-2 py-2 text-center text-lg font-semibold text-[#4A3B7C] outline-none"
            />
            <span className="text-sm text-[#9C94C4]">日</span>
          </div>
        )}

        {granularity === "day" && (
          <button type="button" onClick={() => setViewMode((v) => (v === "calendar" ? "manual" : "calendar"))} className="text-xs font-medium text-[#6F5FD6]">
            {viewMode === "calendar" ? "切換為手動輸入" : "切換為圖形選擇"}
          </button>
        )}
      </div>
    </Modal>
  );
}
