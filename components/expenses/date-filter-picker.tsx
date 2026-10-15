"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/expenses/button";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { DatePickerModal } from "@/components/expenses/date-picker-modal";
import type { DateFilterMode } from "@/lib/expenses/date-filter";

const MODES: { value: DateFilterMode; label: string }[] = [
  { value: "day", label: "日" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自訂" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function shiftDay(year: number, month: number, day: number, delta: number) {
  const d = new Date(year, month - 1, day + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** 上一期／下一期的小箭頭 + 當前期間文字，統一這個樣式，年／月／日三種模式各自只是
 *  傳進來的文字跟換期邏輯不同。寬度跟著內容走（不是 w-full），才擠得進分類切換旁邊
 *  同一列。 */
function PeriodNav({ label, onPrev, onNext, onLabelClick }: { label: string; onPrev: () => void; onNext: () => void; onLabelClick?: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#ECE4FA] bg-white py-1 pl-1 pr-2">
      <button type="button" onClick={onPrev} aria-label="上一期" className="grid size-6 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]">
        ‹
      </button>
      {onLabelClick ? (
        <button type="button" onClick={onLabelClick} className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">
          {label}
        </button>
      ) : (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">{label}</span>
      )}
      <button type="button" onClick={onNext} aria-label="下一期" className="grid size-6 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]">
        ›
      </button>
    </div>
  );
}

/** 分類切換（年／月／日／全部／自訂）跟當前期間導覽並排在同一列——跟「趨勢」區塊的
 *  頻率切換＋標題同一種「一排放不下就自動換行」的排法（flex-wrap），不用另外處理
 *  窄螢幕的特例。「自訂」的起訖日期欄位比較寬，擺不進同一列，另外佔一整列。 */
export function DateFilterPicker({ className = "" }: { className?: string }) {
  const { filter, setFilter, setMode } = useDateFilter();
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [customField, setCustomField] = useState<"start" | "end" | null>(null);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl value={filter.mode} onChange={setMode} options={MODES} />

        {filter.mode === "year" && (
          <PeriodNav
            label={`${filter.year}`}
            onPrev={() => setFilter({ ...filter, year: filter.year - 1 })}
            onNext={() => setFilter({ ...filter, year: filter.year + 1 })}
          />
        )}

        {filter.mode === "month" && (
          <PeriodNav
            label={`${filter.year}/${pad2(filter.month)}`}
            onPrev={() => {
              const d = new Date(filter.year, filter.month - 2, 1);
              setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
            }}
            onNext={() => {
              const d = new Date(filter.year, filter.month, 1);
              setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
            }}
          />
        )}

        {filter.mode === "day" && (
          <PeriodNav
            label={`${filter.year}/${pad2(filter.month)}/${pad2(filter.day)}`}
            onPrev={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, -1) })}
            onNext={() => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, 1) })}
            onLabelClick={() => setDayPickerOpen(true)}
          />
        )}
      </div>

      {filter.mode === "day" && (
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
      )}

      {filter.mode === "custom" && (
        <>
          <div className="mt-2 flex w-full items-center gap-2 rounded-full border border-[#ECE4FA] bg-white p-1 pl-3">
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
  );
}
