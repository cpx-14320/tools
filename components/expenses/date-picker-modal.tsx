"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import {
  CalendarGrid,
  CalendarHeader,
  MonthGrid,
  YearGrid,
  dayButtonClass,
  daysInMonth,
  pad2,
  parseISO,
  shiftMonth,
  toISO,
} from "./calendar";

export type DateGranularity = "day" | "month";

type View = "year" | "month" | "day";

/** 記帳本共用日期／月份選擇器——標題列的「年」「月」都可以個別點開單獨切換（年份跳
 *  列表選、月份跳 12 格選），不用只能靠 ‹ › 一格一格翻；年/月/日都是圖形選擇，沒有
 *  原生數字輸入框。月曆本身的零件（年份格、月份格、標題列、日期格）跟區間選擇器
 *  共用同一份，見 calendar.tsx。 */
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
  const parsed = parseISO(initial);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [view, setView] = useState<View>(granularity === "month" ? "month" : "day");

  const now = new Date();
  const todayStr = toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());

  function changeMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
    // 原本選的是 31 號、翻到只有 30 天的月份時要往回夾，不然會產生不存在的日期。
    setDay((d) => Math.min(d, daysInMonth(next.year, next.month)));
  }

  function pickYear(y: number) {
    setYear(y);
    setView(granularity === "month" ? "month" : "day");
  }

  function pickMonth(m: number) {
    setMonth(m);
    setDay((d) => Math.min(d, daysInMonth(year, m)));
    setView(granularity === "month" ? "month" : "day");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={granularity === "month" ? "選擇月份" : "選擇日期"}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave(granularity === "month" ? `${year}-${pad2(month)}` : toISO(year, month, day))}
        />
      }
    >
      <div className="flex flex-col items-center gap-4">
        {view === "year" ? (
          <YearGrid year={year} onSelect={pickYear} />
        ) : granularity === "month" || view === "month" ? (
          <MonthGrid year={year} month={month} onSelectYear={() => setView("year")} onSelectMonth={pickMonth} />
        ) : (
          <>
            <CalendarHeader
              year={year}
              month={month}
              onPrev={() => changeMonth(-1)}
              onNext={() => changeMonth(1)}
              onSelectYear={() => setView("year")}
              onSelectMonth={() => setView("month")}
            />
            <CalendarGrid
              year={year}
              month={month}
              renderDay={(d, iso) => (
                <button type="button" onClick={() => setDay(d)} className={dayButtonClass({ selected: d === day, today: iso === todayStr })}>
                  {d}
                </button>
              )}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
