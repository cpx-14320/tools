"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import { CalendarGrid, CalendarHeader, YearGrid, dayButtonClass, parseISO, shiftMonth, toISO } from "./calendar";

/** 起訖日期選擇器——同一個彈窗裡選完起訖，不用分開跳兩次窗。第一下點選起始日，第二下
 *  點選結束日（點到比起始日早的話自動對調），選定的區間用連續色塊呈現（起訖兩端是
 *  實心圓點，中間的日子背景連成一條色塊，不是一格一格分開的圓點），一眼就看得出
 *  選了哪一段區間；再點一下會重新開始選一個新區間。
 *
 *  月曆零件跟單日選擇器共用（見 calendar.tsx），差別只在每一格的上色方式。 */
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

  function changeMonth(delta: number) {
    const next = shiftMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function pickDay(iso: string) {
    if (!anchor) {
      // 重新開始選一個新區間。
      setAnchor(iso);
      setStart(iso);
      setEnd(iso);
      return;
    }
    if (iso < anchor) {
      setStart(iso);
      setEnd(anchor);
    } else {
      setStart(anchor);
      setEnd(iso);
    }
    setAnchor(null);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="選擇區間"
      footer={<ModalFooter onClose={onClose} onConfirm={() => onSave(start, end)} />}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F9F7FE] px-3 py-2 text-sm font-medium text-[#4A3B7C]">
          <span>{start}</span>
          <span className="text-[#C7BFE6]">～</span>
          <span>{end}</span>
        </div>

        {view === "year" ? (
          <YearGrid
            year={viewYear}
            onSelect={(y) => {
              setViewYear(y);
              setView("day");
            }}
          />
        ) : (
          <>
            <CalendarHeader
              year={viewYear}
              month={viewMonth}
              onPrev={() => changeMonth(-1)}
              onNext={() => changeMonth(1)}
              onSelectYear={() => setView("year")}
            />
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              renderDay={(d, iso) => {
                const isStart = iso === start;
                const isEnd = iso === end;
                const inRange = iso > start && iso < end;
                // 外層這一格負責把區間中間的日子串成一條連續色塊（起訖兩端只圓一邊），
                // 內層的圓鈕才是可以點的那一天。
                const band =
                  isStart && isEnd ? "" : isStart ? "rounded-l-full bg-[#F3EFFC]" : isEnd ? "rounded-r-full bg-[#F3EFFC]" : inRange ? "bg-[#F3EFFC]" : "";
                return (
                  <div className={band}>
                    <button
                      type="button"
                      onClick={() => pickDay(iso)}
                      className={
                        inRange && !isStart && !isEnd
                          ? "mx-auto grid size-9 place-items-center rounded-full text-sm font-medium text-[#4A3B7C] transition-colors"
                          : dayButtonClass({ selected: isStart || isEnd, today: iso === todayStr })
                      }
                    >
                      {d}
                    </button>
                  </div>
                );
              }}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
