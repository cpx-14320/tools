"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const YEAR_GRID_SPAN = 12;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseISO(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) ? m : now.getMonth() + 1,
    day: Number.isFinite(d) ? d : now.getDate(),
  };
}

/** 起訖日期選擇器——同一個彈窗裡選完起訖，不用分開跳兩次窗。第一下點選起始日，第二下
 *  點選結束日（點到比起始日早的話自動對調），選定的區間用連續色塊呈現（起訖兩端是
 *  實心圓點，中間的日子背景連成一條色塊，不是一格一格分開的圓點），一眼就看得出
 *  選了哪一段區間；再點一下會重新開始選一個新區間。 */
export function DateRangePickerModal({
  open,
  initialStart,
  initialEnd,
  onClose,
  onSave,
}: {
  open: boolean;
  initialStart: string;
  initialEnd: string;
  onClose: () => void;
  onSave: (start: string, end: string) => void;
}) {
  const startParsed = parseISO(initialStart);
  const [viewYear, setViewYear] = useState(startParsed.year);
  const [viewMonth, setViewMonth] = useState(startParsed.month);
  const [view, setView] = useState<"year" | "day">("day");
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  // 選區間的「錨點」：第一下點的那個日期先暫存在這，第二下點了才真的決定起訖兩端，
  // 這之間畫面上先當成「單一天」的選取狀態顯示。
  const [anchor, setAnchor] = useState<string | null>(null);

  const now = new Date();
  const todayStr = toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const totalDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  function changeMonth(delta: number) {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  }

  function pickDay(d: number) {
    const clicked = toISO(viewYear, viewMonth, d);
    if (!anchor) {
      // 重新開始選一個新區間。
      setAnchor(clicked);
      setStart(clicked);
      setEnd(clicked);
      return;
    }
    if (clicked < anchor) {
      setStart(clicked);
      setEnd(anchor);
    } else {
      setStart(anchor);
      setEnd(clicked);
    }
    setAnchor(null);
  }

  function pickYear(y: number) {
    setViewYear(y);
    setView("day");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="選擇區間"
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button onClick={() => onSave(start, end)}>確定</Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F9F7FE] px-3 py-2 text-sm font-medium text-[#4A3B7C]">
          <span>{start}</span>
          <span className="text-[#C7BFE6]">～</span>
          <span>{end}</span>
        </div>

        {view === "year" ? (
          <div className="max-h-[320px] w-full overflow-y-auto">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: YEAR_GRID_SPAN * 2 + 1 }, (_, i) => viewYear - YEAR_GRID_SPAN + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => pickYear(y)}
                  className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    y === viewYear ? "bg-[#6F5FD6] text-white" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex w-full items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="上個月"
                className="grid size-8 shrink-0 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
              >
                ‹
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setView("year")}
                  className="rounded-full px-2 py-1 text-base font-semibold text-[#4A3B7C] hover:bg-[#EFEAFC]"
                >
                  {viewYear}年
                </button>
                <span className="text-base font-semibold text-[#4A3B7C]">{viewMonth}月</span>
              </div>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="下個月"
                className="grid size-8 shrink-0 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
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
                if (d === null) return <span key={`blank-${i}`} className="h-9" />;
                const iso = toISO(viewYear, viewMonth, d);
                const isStart = iso === start;
                const isEnd = iso === end;
                const inRange = iso > start && iso < end;
                const isToday = iso === todayStr;
                return (
                  <div
                    key={d}
                    className={
                      isStart && isEnd
                        ? ""
                        : isStart
                          ? "rounded-l-full bg-[#F3EFFC]"
                          : isEnd
                            ? "rounded-r-full bg-[#F3EFFC]"
                            : inRange
                              ? "bg-[#F3EFFC]"
                              : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() => pickDay(d)}
                      className={`mx-auto grid size-9 place-items-center rounded-full text-sm font-medium transition-colors ${
                        isStart || isEnd
                          ? "bg-[#6F5FD6] text-white"
                          : inRange
                            ? "text-[#4A3B7C]"
                            : isToday
                              ? "bg-[#EFEAFC] text-[#6F5FD6]"
                              : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
                      }`}
                    >
                      {d}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
