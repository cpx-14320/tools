"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const YEAR_GRID_SPAN = 12; // 年份列表往前往後各抓幾年，中間夾著目前選到的那年

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

/** 年份選擇格——日期／月份選擇器共用，點了年份數字就會切來這一層，不是只能用 ‹ › 一年
 *  一年翻。以目前瀏覽的年份為中心，前後各抓 YEAR_GRID_SPAN 年，4 欄排列，可以上下捲動。 */
function YearGrid({ year, onSelect }: { year: number; onSelect: (year: number) => void }) {
  const start = year - YEAR_GRID_SPAN;
  const years = Array.from({ length: YEAR_GRID_SPAN * 2 + 1 }, (_, i) => start + i);
  return (
    <div className="max-h-[320px] w-full overflow-y-auto">
      <div className="grid grid-cols-4 gap-2">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onSelect(y)}
            className={`rounded-xl py-2.5 text-sm font-medium transition-colors ${
              y === year ? "bg-[#6F5FD6] text-white" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 12 個月份格——月份篩選器（granularity="month"）跟日期篩選器點月份切換過來的子畫面
 *  共用同一個，不要兩邊各刻一份一樣的格子。 */
function MonthGrid({
  year,
  month,
  onSelectYear,
  onSelectMonth,
}: {
  year: number;
  month: number;
  onSelectYear: () => void;
  onSelectMonth: (month: number) => void;
}) {
  const now = new Date();
  return (
    <>
      <div className="flex w-full items-center justify-center gap-1.5">
        <button type="button" onClick={onSelectYear} className="rounded-full px-3 py-1 text-base font-semibold text-[#4A3B7C] hover:bg-[#EFEAFC]">
          {year} ▾
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
              onClick={() => onSelectMonth(m)}
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
  );
}

type View = "year" | "month" | "day";

/** 記帳本共用日期／月份選擇器——標題列的「年」「月」都可以個別點開單獨切換（年份跳
 *  列表選、月份跳 12 格選），不用只能靠 ‹ › 一格一格翻；拿掉原本的「手動輸入」模式
 *  （原生數字輸入框），年/月/日都改成跟搭乘車同一套圖形選擇。 */
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
  const [view, setView] = useState<View>(granularity === "month" ? "month" : "day");

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

  function pickYear(y: number) {
    setYear(y);
    setView(granularity === "month" ? "month" : "day");
  }

  function pickMonth(m: number) {
    setMonth(m);
    setDay((d) => Math.min(d, daysInMonth(year, m)));
    setView(granularity === "month" ? "month" : "day");
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
        {view === "year" ? (
          <YearGrid year={year} onSelect={pickYear} />
        ) : granularity === "month" || view === "month" ? (
          <MonthGrid year={year} month={month} onSelectYear={() => setView("year")} onSelectMonth={pickMonth} />
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
                  {year}年
                </button>
                <button
                  type="button"
                  onClick={() => setView("month")}
                  className="rounded-full px-2 py-1 text-base font-semibold text-[#4A3B7C] hover:bg-[#EFEAFC]"
                >
                  {month}月
                </button>
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
        )}
      </div>
    </Modal>
  );
}
