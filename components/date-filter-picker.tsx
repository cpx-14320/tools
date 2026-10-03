"use client";

import { useDateFilter } from "@/components/date-filter-context";
import type { DateFilterMode } from "@/lib/mock-data";

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

  return (
    <div className={className}>
      <div className="flex w-full items-center gap-0.5 rounded-full border border-line bg-surface p-1">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => setMode(m.mode)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
              filter.mode === m.mode ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {filter.mode === "year" && (
          <div className="flex w-full items-center justify-between rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setFilter({ ...filter, year: filter.year - 1 })}
              aria-label="上一年"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums">{filter.year} 年</span>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, year: filter.year + 1 })}
              aria-label="下一年"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ›
            </button>
          </div>
        )}

        {filter.mode === "month" && (
          <div className="flex w-full items-center justify-between rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(filter.year, filter.month - 2, 1);
                setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              aria-label="上個月"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ‹
            </button>
            <span className="text-sm font-semibold tabular-nums">
              {filter.year} 年 {filter.month} 月
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(filter.year, filter.month, 1);
                setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
              }}
              aria-label="下個月"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ›
            </button>
          </div>
        )}

        {filter.mode === "day" && (
          <div className="flex w-full items-center justify-between rounded-full border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, -1) })}
              aria-label="前一天"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ‹
            </button>
            <input
              type="date"
              value={`${filter.year}-${pad2(filter.month)}-${pad2(filter.day)}`}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                if (y && m && d) setFilter({ ...filter, year: y, month: m, day: d });
              }}
              className="bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, 1) })}
              aria-label="後一天"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
            >
              ›
            </button>
          </div>
        )}

        {filter.mode === "all" && <p className="w-full px-1 text-xs text-muted">顯示所有期間的資料</p>}

        {filter.mode === "custom" && (
          <div className="flex w-full items-center gap-2 rounded-full border border-line bg-surface p-1 pl-3">
            <input
              type="date"
              value={filter.customStart}
              onChange={(e) => setFilter({ ...filter, customStart: e.target.value })}
              className="w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <span className="shrink-0 text-muted">～</span>
            <input
              type="date"
              value={filter.customEnd}
              onChange={(e) => setFilter({ ...filter, customEnd: e.target.value })}
              className="w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
