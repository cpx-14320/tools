"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import { CalendarGrid, CalendarHeader, MonthGrid, YearGrid, dayButtonClass, parseISO, shiftMonth, toISO } from "./calendar";

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
  // 年／月／日三層：點標題上的年份跳年份格、點月份跳月份格，挑完回到日期格。起訖的
  // 年月日都從這一組操作裡設定，所以上面不用再掛一條「2026-10-01 ～ 2026-10-31」的
  // 摘要列——那一列只是把已經看得到的資訊再寫一次，卻吃掉一整排高度。
  const [view, setView] = useState<"year" | "month" | "day">("day");
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
        {view === "year" ? (
          <YearGrid
            year={viewYear}
            onSelect={(y) => {
              setViewYear(y);
              // 挑完年份回到月份格：接著就是挑月，不用再點一次標題。
              setView("month");
            }}
          />
        ) : view === "month" ? (
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            onSelectYear={() => setView("year")}
            onSelectMonth={(m) => {
              setViewMonth(m);
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
              onSelectMonth={() => setView("month")}
            />
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              renderDay={(d, iso) => {
                const isStart = iso === start;
                const isEnd = iso === end;
                const inRange = iso > start && iso < end;
                const single = isStart && isEnd;
                // 色塊（band）跟日期圓鈕分兩層疊：band 是絕對定位的一條，高度跟圓鈕
                // 一樣（h-9），所以上下留白一致；起訖那兩格的 band 只蓋半格——從格子
                // 中線（＝圓鈕的圓心）往區間內側延伸到格子邊緣，跟隔壁那格接起來就是
                // 一條連續的色帶，而不是像以前那樣整格都鋪、在圓鈕外面凸出一截。
                const band = single
                  ? ""
                  : isStart
                    ? "inset-y-0 left-1/2 right-0"
                    : isEnd
                      ? "inset-y-0 left-0 right-1/2"
                      : inRange
                        ? "inset-0"
                        : "";
                return (
                  <div className="relative h-9">
                    {band && <span aria-hidden className={`absolute bg-[#F3EFFC] ${band}`} />}
                    <button
                      type="button"
                      onClick={() => pickDay(iso)}
                      className={`relative ${
                        inRange && !isStart && !isEnd
                          ? "mx-auto grid size-9 place-items-center rounded-full text-sm font-medium text-[#4A3B7C] transition-colors"
                          : dayButtonClass({ selected: isStart || isEnd, today: iso === todayStr })
                      }`}
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
