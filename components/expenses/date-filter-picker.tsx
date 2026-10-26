"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/expenses/button";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { DatePickerModal } from "@/components/expenses/date-picker-modal";
import { DateRangePickerModal } from "@/components/expenses/date-range-picker-modal";
import type { DateFilterMode } from "@/lib/expenses/date-filter";

const MODES: { value: DateFilterMode; label: string }[] = [
  { value: "day", label: "日" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自訂" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 期間膠囊的文字——是今年就不寫年份。
 *
 *  「2026/10」「2026/10/27」太長，跟左邊那排日／月／年／全部／自訂加起來超過一列的寬度，
 *  在手機上會折成兩行。而看帳本九成的時間都停在今年，年份是一個幾乎不會變的前綴，
 *  省掉之後「10 月」「10/27」就塞得進同一列；真的翻到別的年份才補回年份，不會看錯。 */
function periodLabel(year: number, thisYear: number, parts: string[]): string {
  return year === thisYear ? parts.join("/") : [String(year), ...parts].join("/");
}

/** 從 `YYYY-MM-DD` 取出年月。選了自訂區間時 year/month 也要跟著更新——「本月預算」那種
 *  以月為單位的卡片是讀 filter.year/month（見 referenceYearMonth），不更新的話畫面上
 *  會變成期間寫著 10 月、預算卡卻還停在 9 月。 */
function yearMonthOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

function shiftDay(year: number, month: number, day: number, delta: number) {
  const d = new Date(year, month - 1, day + delta);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/** 上一期／下一期的小箭頭 + 當前期間文字，統一這個樣式，年／月／日三種模式各自只是
 *  傳進來的文字跟換期邏輯不同。寬度跟著內容走（不是 w-full），才擠得進分類切換旁邊
 *  同一列。 */
function PeriodNav({
  label,
  onPrev,
  onNext,
  onLabelClick,
  nextDisabled = false,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onLabelClick?: () => void;
  /** 已經是最新的一期（例如本月）時把「下一期」變灰——還沒發生的月份沒有紀錄可以看。 */
  nextDisabled?: boolean;
}) {
  const arrowClass = "grid size-6 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]";
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#ECE4FA] bg-white py-1 pl-1 pr-2">
      <button type="button" onClick={onPrev} aria-label="上一期" className={arrowClass}>
        ‹
      </button>
      {onLabelClick ? (
        <button type="button" onClick={onLabelClick} className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">
          {label}
        </button>
      ) : (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">{label}</span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label="下一期"
        className={`${arrowClass} disabled:pointer-events-none disabled:text-[#DDD6F3]`}
      >
        ›
      </button>
    </div>
  );
}

/** 分類切換（年／月／日／全部／自訂）跟當前期間導覽並排在同一列——跟「趨勢」區塊的
 *  頻率切換＋標題同一種「一排放不下就自動換行」的排法（flex-wrap），不用另外處理
 *  窄螢幕的特例。「自訂」的起訖日期欄位比較寬，擺不進同一列，另外佔一整列。 */
export function DateFilterPicker({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { filter, setFilter, setMode } = useDateFilter();
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  // 「今年」掛載時算一次固定住——在 render 當中讀時鐘是不純的（年份本身一整年都一樣，
  // 伺服器端與瀏覽器端算出來的值不會不同，不會造成 hydration 不一致）。
  const [thisYear] = useState(() => new Date().getFullYear());

  if (compact) return <CompactDateFilterPicker className={className} />;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl size="xs" value={filter.mode} onChange={setMode} options={MODES} />

        {filter.mode === "year" && (
          <PeriodNav
            label={`${filter.year}`}
            onPrev={() => setFilter({ ...filter, year: filter.year - 1 })}
            onNext={() => setFilter({ ...filter, year: filter.year + 1 })}
          />
        )}

        {filter.mode === "month" && (
          <PeriodNav
            label={filter.year === thisYear ? `${filter.month} 月` : `${filter.year}/${pad2(filter.month)}`}
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
            label={periodLabel(filter.year, thisYear, [pad2(filter.month), pad2(filter.day)])}
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
          <button
            type="button"
            onClick={() => setRangePickerOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#ECE4FA] bg-white py-2 text-sm text-[#4A3B7C]"
          >
            <span>{filter.customStart}</span>
            <span className="text-[#9C94C4]">～</span>
            <span>{filter.customEnd}</span>
          </button>
          <DateRangePickerModal
            open={rangePickerOpen}
            initialStart={filter.customStart}
            initialEnd={filter.customEnd}
            onClose={() => setRangePickerOpen(false)}
            onSave={(start, end) => {
              setFilter({ ...filter, ...yearMonthOf(start), customStart: start, customEnd: end });
              setRangePickerOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

/** 精簡版：只有一顆「2026/10 ‹ ›」的膠囊，沒有日／月／年／全部／自訂那排頁籤。
 *
 *  ‹ › 一次換一個月，已經是本月時「下一月」變灰（還沒發生的月份沒東西可看）；點中間的
 *  日期開年月選擇器，只挑年跟月、不挑區間——首頁講的是「這個月」（本月結餘、本月收入、
 *  本月預算支出），挑一段任意區間的話那些標題就對不上了。要看任意區間請用報表頁。
 *
 *  給版面緊的頁面用（首頁）：頁籤那一排佔掉一整列，但九成的時候使用者只是要看某個月。 */
function CompactDateFilterPicker({ className = "" }: { className?: string }) {
  const { filter, setFilter } = useDateFilter();
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // 「這個月」掛載時算一次固定住——render 當中讀時鐘是不純的。
  const [nowYearMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const custom = filter.mode === "custom";
  // 自訂區間時（從報表頁切過來的），箭頭以區間起始日所在的月份為基準往前後走。
  const baseYear = custom ? Number(filter.customStart.slice(0, 4)) : filter.year;
  const baseMonth = custom ? Number(filter.customStart.slice(5, 7)) : filter.month;
  const atCurrentMonth = filter.mode === "month" && filter.year === nowYearMonth.year && filter.month === nowYearMonth.month;

  // 標籤一定要講真話：篩選器是跟其他頁共用的，在報表頁選了「全部」或「年」再回首頁，
  // 這顆以前照樣寫「2026/10」，但下面的數字其實是全部期間的——兩邊對不起來，而且看
  // 不出原因。現在直接把當下的模式寫出來，按一下箭頭就會回到按月瀏覽。
  const label = (() => {
    switch (filter.mode) {
      case "all":
        return "全部期間";
      case "year":
        return `${filter.year}年`;
      case "day":
        return `${filter.year}/${pad2(filter.month)}/${pad2(filter.day)}`;
      case "custom":
        return `${filter.customStart} ～ ${filter.customEnd}`;
      case "month":
        return `${filter.year}/${pad2(filter.month)}`;
    }
  })();

  function goMonth(delta: number) {
    const d = new Date(baseYear, baseMonth - 1 + delta, 1);
    setFilter({ ...filter, mode: "month", year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  return (
    <div className={`flex justify-center ${className}`}>
      <PeriodNav
        label={label}
        onPrev={() => goMonth(-1)}
        onNext={() => goMonth(1)}
        nextDisabled={atCurrentMonth}
        onLabelClick={() => setMonthPickerOpen(true)}
      />
      {/* granularity="month"：選年、選月兩步就結束，不會再跳到選日。 */}
      <DatePickerModal
        open={monthPickerOpen}
        granularity="month"
        initial={`${baseYear}-${pad2(baseMonth)}`}
        onClose={() => setMonthPickerOpen(false)}
        onSave={(value) => {
          const [y, m] = value.split("-").map(Number);
          setFilter({ ...filter, mode: "month", year: y, month: m });
          setMonthPickerOpen(false);
        }}
      />
    </div>
  );
}
