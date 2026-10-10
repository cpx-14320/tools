"use client";

import { useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function parseDate(value: string): { year: number; month: number; day: number } {
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) ? m : now.getMonth() + 1,
    day: Number.isFinite(d) ? d : now.getDate(),
  };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// 該月 1 號是星期幾（0=日...6=六），用來算月曆格子前面要留幾個空白。
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function DatePickerModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const parsed = parseDate(initial);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [viewMode, setViewMode] = useState<"calendar" | "manual">("calendar");

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
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

  function setManualYear(v: number) {
    setYear(v);
    setDay((d) => Math.min(d, daysInMonth(v, month)));
  }

  return (
    <BottomSheetModal
      open={open}
      title="選擇日期"
      onClose={onClose}
      bodyClassName="flex flex-col items-center gap-4 px-5 py-5"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(formatDate(year, month, day))}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            確定
          </button>
        </>
      }
    >
      {viewMode === "calendar" ? (
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
              const isToday = formatDate(year, month, d) === todayStr;
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
              if (Number.isFinite(v)) setManualYear(v);
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

      <button
        type="button"
        onClick={() => setViewMode((v) => (v === "calendar" ? "manual" : "calendar"))}
        className="text-xs font-medium text-[#6F5FD6]"
      >
        {viewMode === "calendar" ? "切換為手動輸入" : "切換為圖形選擇"}
      </button>
    </BottomSheetModal>
  );
}
