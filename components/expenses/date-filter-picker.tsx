"use client";

import { useState } from "react";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { DatePickerModal } from "@/components/expenses/date-picker-modal";
import type { DateFilterMode } from "@/lib/expenses/date-filter";

const MODES: { mode: DateFilterMode; label: string }[] = [
  { mode: "year", label: "年" },
  { mode: "month", label: "月" },
  { mode: "day", label: "日" },
  { mode: "all", label: "全部" },
  { mode: "custom", label: "自訂" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function shiftDay(year: number, month: number, day: number, delta: number) {
  const d = new Date(year, month - 1, day + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function DateFilterPicker({ className = "" }: { className?: string }) {
  const { filter, setFilter, setMode } = useDateFilter();
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [customField, setCustomField] = useState<"start" | "end" | null>(null);

  return (
    <div className={className}>
      <div className="flex w-full items-center gap-0.5 rounded-full bg-[#F3EFFC] p-1">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => setMode(m.mode)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
              filter.mode === m.mode ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4] hover:text-[#6F5FD6]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {filter.mode === "year" && (
          <div className="flex w-full items-center justify-between rounded-full border border-[#ECE4FA] bg-white p-1">
            <button
              type="button"
              onClick={() => setFilter({ ...filter, year: filter.year - 1 })}
              aria-label="上一年"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums text-[#4A3B7C]">{filter.year} 年</span>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, year: filter.year + 1 })}
              aria-label="下一年"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
            >
              ›
            </button>
          </div>
        )}

        {filter.mode === "month" && (
          <div className="flex w-full items-center justify-between rounded-full border border-[#ECE4FA] bg-white p-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(filter.year, filter.month - 2, 1);
                setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              aria-label="上個月"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums text-[#4A3B7C]">
              {filter.year} 年 {filter.month} 月
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(filter.year, filter.month, 1);
                setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              aria-label="下個月"
              className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
            >
              ›
            </button>
          </div>
        )}

        {filter.mode === "day" && (
          <>
            <div className="flex w-full items-center justify-between rounded-full border border-[#ECE4FA] bg-white p-1">
              <button
                type="button"
                onClick={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, -1) })}
                aria-label="前一天"
                className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
              >
                ‹
              </button>
              <button type="button" onClick={() => setDayPickerOpen(true)} className="text-sm font-semibold tabular-nums text-[#4A3B7C]">
                {filter.year}/{pad2(filter.month)}/{pad2(filter.day)}
              </button>
              <button
                type="button"
                onClick={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, 1) })}
                aria-label="後一天"
                className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
              >
                ›
              </button>
            </div>
            <DatePickerModal
              open={dayPickerOpen}
              initial={`${filter.year}-${pad2(filter.month)}-${pad2(filter.day)}`}
              onClose={() => setDayPickerOpen(false)}
              onSave={(v) => {
                const [y, m, d] = v.split("-").map(Number);
                setFilter({ ...filter, year: y, month: m, day: d });
                setDayPickerOpen(false);
              }}
            />
          </>
        )}

        {filter.mode === "all" && <p className="w-full px-1 text-xs text-[#9C94C4]">顯示所有期間的資料</p>}

        {filter.mode === "custom" && (
          <>
            <div className="flex w-full items-center gap-2 rounded-full border border-[#ECE4FA] bg-white p-1 pl-3">
              <button type="button" onClick={() => setCustomField("start")} className="w-0 flex-1 truncate text-left text-sm text-[#4A3B7C]">
                {filter.customStart}
              </button>
              <span className="shrink-0 text-[#9C94C4]">～</span>
              <button type="button" onClick={() => setCustomField("end")} className="w-0 flex-1 truncate text-left text-sm text-[#4A3B7C]">
                {filter.customEnd}
              </button>
            </div>
            <DatePickerModal
              open={customField === "start"}
              initial={filter.customStart}
              onClose={() => setCustomField(null)}
              onSave={(v) => {
                setFilter({ ...filter, customStart: v });
                setCustomField(null);
              }}
            />
            <DatePickerModal
              open={customField === "end"}
              initial={filter.customEnd}
              onClose={() => setCustomField(null)}
              onSave={(v) => {
                setFilter({ ...filter, customEnd: v });
                setCustomField(null);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
