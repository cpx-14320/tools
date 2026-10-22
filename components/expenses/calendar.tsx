"use client";

import type { ReactNode } from "react";

/** 日期選擇器共用的那一套月曆零件——單日選擇（DatePickerModal）跟區間選擇
 *  （DateRangePickerModal）本來各自複製了一份一模一樣的常數、日期算式、年份格、
 *  月份格、月份導覽列跟日期格排版，只有「每一格怎麼上色」不一樣。共用的部分集中在
 *  這裡，不一樣的那一塊交給呼叫端用 renderDay 自己決定。 */

export const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
export const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
/** 年份列表往前往後各抓幾年，中間夾著目前選到的那年。 */
export const YEAR_GRID_SPAN = 12;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 該月 1 號是星期幾（0=日...6=六），用來算月曆格子前面要留幾個空白。 */
export function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 解析 `YYYY-MM-DD`；空字串或缺的欄位一律退回「今天」。
 *
 *  每一段都要大於 0 才算數，不能只看 Number.isFinite——`Number("")` 是 0 而不是 NaN，
 *  所以空字串（例如存錢目標那種「可不填」的日期）會被當成西元 0 年，年份格就會列出
 *  0 年前後那十幾年。 */
export function parseISO(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  const ok = (n: number) => Number.isFinite(n) && n > 0;
  return {
    year: ok(y) ? y : now.getFullYear(),
    month: ok(m) ? m : now.getMonth() + 1,
    day: ok(d) ? d : now.getDate(),
  };
}

/** 月曆格子的內容：前面補幾個 null 當空白，後面才是 1～月底。 */
export function monthCells(year: number, month: number): (number | null)[] {
  return [...Array(firstWeekday(year, month)).fill(null), ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)];
}

/** 往前／往後翻一個月，跨年自動進位。 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = new Date(year, month - 1 + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}

/** 年份選擇格——點了標題列的年份就切來這一層，不是只能用 ‹ › 一年一年翻。以目前瀏覽的
 *  年份為中心，前後各抓 YEAR_GRID_SPAN 年，4 欄排列，可以上下捲動。 */
export function YearGrid({ year, onSelect }: { year: number; onSelect: (year: number) => void }) {
  const years = Array.from({ length: YEAR_GRID_SPAN * 2 + 1 }, (_, i) => year - YEAR_GRID_SPAN + i);
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

/** 12 個月份格——月份篩選器跟日期選擇器點月份切換過來的子畫面共用同一個。 */
export function MonthGrid({
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

/** 月曆標題列：‹ 2026年 10月 ›。年份一定可以點開年份格；月份只有在「可以單獨切月份」
 *  的情境（單日選擇器）才給 onSelectMonth，區間選擇器不給就只是純文字。 */
export function CalendarHeader({
  year,
  month,
  onPrev,
  onNext,
  onSelectYear,
  onSelectMonth,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectYear: () => void;
  onSelectMonth?: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        aria-label="上個月"
        className="grid size-8 shrink-0 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
      >
        ‹
      </button>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onSelectYear} className="rounded-full px-2 py-1 text-base font-semibold text-[#4A3B7C] hover:bg-[#EFEAFC]">
          {year}年
        </button>
        {onSelectMonth ? (
          <button type="button" onClick={onSelectMonth} className="rounded-full px-2 py-1 text-base font-semibold text-[#4A3B7C] hover:bg-[#EFEAFC]">
            {month}月
          </button>
        ) : (
          <span className="text-base font-semibold text-[#4A3B7C]">{month}月</span>
        )}
      </div>
      <button
        type="button"
        onClick={onNext}
        aria-label="下個月"
        className="grid size-8 shrink-0 place-items-center rounded-full text-[#6F5FD6] hover:bg-[#F3EFFC]"
      >
        ›
      </button>
    </div>
  );
}

/** 星期標題＋日期格排版。每一格長什麼樣子由 renderDay 決定——單日選擇是一顆圓鈕，
 *  區間選擇要在圓鈕外面再包一層連成色塊的底，兩種差太多，不硬塞成同一套樣式參數。 */
export function CalendarGrid({ year, month, renderDay }: { year: number; month: number; renderDay: (day: number, iso: string) => ReactNode }) {
  return (
    <div className="grid w-full grid-cols-7 gap-y-1.5">
      {WEEKDAYS.map((w) => (
        <span key={w} className="text-center text-xs font-medium text-[#B3ABD4]">
          {w}
        </span>
      ))}
      {monthCells(year, month).map((d, i) =>
        d === null ? <span key={`blank-${i}`} className="h-9" /> : <div key={d}>{renderDay(d, toISO(year, month, d))}</div>,
      )}
    </div>
  );
}

/** 共用的「一天」圓鈕樣式——選中紫底白字、今天淡紫底紫字、其他則是一般字色。 */
export function dayButtonClass({ selected, today }: { selected: boolean; today: boolean }): string {
  return `mx-auto grid size-9 place-items-center rounded-full text-sm font-medium transition-colors ${
    selected ? "bg-[#6F5FD6] text-white" : today ? "bg-[#EFEAFC] text-[#6F5FD6]" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
  }`;
}
