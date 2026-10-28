"use client";

import { useState, type ReactNode } from "react";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { DatePickerModal } from "@/components/expenses/date-picker-modal";
import { DateRangePickerModal } from "@/components/expenses/date-range-picker-modal";
import { Modal } from "@/components/expenses/modal";
import { weekRangeOf, type DateFilter, type DateFilterMode } from "@/lib/expenses/date-filter";

/** 彈窗裡那排可以選的期間單位。順序是從短到長，最後才是「全部」——翻帳本最常切的是
 *  天／週／月，擺在手指最容易按到的上面幾列。
 *
 *  只有單位名稱、沒有說明小字：「天」「週」「月」「年」本來就不需要解釋，六列各掛一行
 *  灰字只是把彈窗拉長一倍，真正要按的那一列反而要捲才看得到。 */
const MODE_OPTIONS: { value: DateFilterMode; label: string }[] = [
  { value: "day", label: "天" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
  { value: "custom", label: "自訂" },
  { value: "all", label: "全部" },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

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

/** `2026-10-18` → `10/18`。週區間的兩端同年時只寫月日就夠了。 */
const monthDay = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

/** `2026-10-18` → `10/18/26`。年份只留後兩位，膠囊才裝得下一整段區間的起訖。 */
const monthDayYear = (iso: string) => `${monthDay(iso)}/${iso.slice(2, 4)}`;

/** 膠囊上那一行字——現在看的是哪一段。
 *
 *  年份一律寫出來（`2026/10/28`、`2026/10`）：日／月／年那排頁籤收進日曆彈窗之後這一列
 *  只剩膠囊跟兩顆圖示，寬度夠了，不用再像以前那樣「是今年就省掉年份」去擠版面——省年份
 *  的代價是翻到別的年份時兩種寫法交替出現，反而要多看一眼才確定自己在哪一年。 */
function periodLabel(f: DateFilter): string {
  switch (f.mode) {
    case "day":
      return `${f.year}/${pad2(f.month)}/${pad2(f.day)}`;
    case "week": {
      const { start, end } = weekRangeOf(f.year, f.month, f.day);
      // 同一年就只寫月日（`10/18 - 10/24`）。跨年的那一週才把年份補回來，不然
      // 「12/27 - 01/02」看不出後面那幾天已經算下一年的了。
      return start.slice(0, 4) === end.slice(0, 4)
        ? `${monthDay(start)} - ${monthDay(end)}`
        : `${monthDayYear(start)} - ${monthDayYear(end)}`;
    }
    case "month":
      return `${f.year}/${pad2(f.month)}`;
    case "year":
      return `${f.year}`;
    case "custom":
      // 自訂是兩個完整日期，寫成四位數年份會長到膠囊裝不下，年份只留後兩位
      // （`10/01/26 - 10/31/26`）——起訖都在同一列，看得出是一段區間就夠了。
      return `${monthDayYear(f.customStart)} - ${monthDayYear(f.customEnd)}`;
    case "all":
      return "全部";
  }
}

/** 上一期／下一期的小箭頭 + 當前期間文字。天／週／月／年四種模式只差在傳進來的文字跟
 *  換期邏輯；「全部」跟「自訂」沒有上下一期，箭頭傳 disabled（留著位子但是灰的，
 *  一眼看得出這個模式不能翻）。整個箭頭不畫也行（不傳 onPrev/onNext），但目前沒有模式
 *  走那條路——膠囊會比其他模式窄一截，切過去時這一列的寬度跟著跳。
 *
 *  寬度跟著內容走（不是 w-full），才擠得進圖示按鈕旁邊同一列。 */
function PeriodNav({
  label,
  onPrev,
  onNext,
  onLabelClick,
  disabled = false,
  nextDisabled = false,
}: {
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
  onLabelClick?: () => void;
  /** 兩邊的箭頭都變灰（「全部」模式）。 */
  disabled?: boolean;
  /** 只有「下一期」變灰——已經是最新的一期（例如本月）時，還沒發生的月份沒紀錄可看。 */
  nextDisabled?: boolean;
}) {
  const arrowClass =
    "grid size-6 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6] disabled:pointer-events-none disabled:text-[#DDD6F3]";
  const hasArrows = Boolean(onPrev || onNext);
  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-full border border-[#ECE4FA] bg-white py-1 ${
        hasArrows ? "pl-1 pr-2" : "px-3"
      }`}
    >
      {hasArrows && (
        <button type="button" onClick={onPrev} disabled={disabled} aria-label="上一期" className={arrowClass}>
          ‹
        </button>
      )}
      {onLabelClick ? (
        <button type="button" onClick={onLabelClick} className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">
          {label}
        </button>
      ) : (
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#4A3B7C]">{label}</span>
      )}
      {hasArrows && (
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || nextDisabled}
          aria-label="下一期"
          className={arrowClass}
        >
          ›
        </button>
      )}
    </div>
  );
}

/** 期間膠囊 ＋ 日曆圖示一列。按日曆開彈窗挑期間單位（天／週／月／年／自訂／全部），
 *  挑完就用膠囊的 ‹ › 一期一期翻、點中間的文字跳著挑。
 *
 *  本來這一列是「日／月／年/全部/自訂」五顆頁籤加一顆膠囊，在手機寬度一定折成兩行，
 *  而且單位這種「設定好就很少再動」的東西佔掉的面積比每天都在按的 ‹ › 還大。改成單位
 *  收進彈窗、列上只留現在看的這一段＋一顆日曆，省下一整列給下面的清單。
 *
 *  `actions` 是同一列最右邊可以外掛的按鈕（消費紀錄頁的篩選圖示）——那是「這份清單要
 *  看什麼」的開關，跟期間是一組的，擺同一列才不用再多一排。 */
export function DateFilterPicker({ className = "", actions }: { className?: string; actions?: ReactNode }) {
  const { filter, setFilter, setMode } = useDateFilter();
  const [modeOpen, setModeOpen] = useState(false);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);

  // 天跟週共用同一個基準日，差別只在一次移幾天（見 date-filter.ts 的 weekRangeOf）。
  const stepDays = filter.mode === "week" ? 7 : 1;
  const shiftMonths = (delta: number) => {
    const d = new Date(filter.year, filter.month - 1 + delta, 1);
    setFilter({ ...filter, year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const nav = (() => {
    switch (filter.mode) {
      case "day":
      case "week":
        return {
          onPrev: () => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, -stepDays) }),
          onNext: () => setFilter({ ...filter, ...shiftDay(filter.year, filter.month, filter.day, stepDays) }),
          onLabelClick: () => setDayPickerOpen(true),
        };
      case "month":
        return { onPrev: () => shiftMonths(-1), onNext: () => shiftMonths(1), onLabelClick: () => setMonthPickerOpen(true) };
      case "year":
        return {
          onPrev: () => setFilter({ ...filter, year: filter.year - 1 }),
          onNext: () => setFilter({ ...filter, year: filter.year + 1 }),
        };
      case "all":
        // 箭頭留著位子但按不動：這個模式本來就沒有上下一期。
        return { onPrev: () => {}, onNext: () => {}, disabled: true };
      case "custom":
        // 箭頭留著位子但按不動（跟「全部」一樣）：自訂區間的長度是使用者自己挑的，
        // 「往前一期」要移幾天沒有合理的答案。整個箭頭不畫的話膠囊會比其他模式窄一截，
        // 切到自訂時這一列的寬度跟著跳；留著灰的也一眼看得出這個模式不能翻。
        // 點中間的文字照樣開區間選擇器。
        return { onPrev: () => {}, onNext: () => {}, disabled: true, onLabelClick: () => setRangePickerOpen(true) };
    }
  })();

  return (
    <>
      {/* 左右兩個區塊：左邊是期間膠囊，右邊是一排圖示。右邊那塊自己是一個 flex 容器，
          所以不管外掛幾顆圖示（日曆一顆、消費紀錄頁再加篩選一顆、以後再加都一樣）全部
          擠在右端對齊，不會像以前那樣一顆一顆從左邊往右長、膠囊旁邊黏著一串按鈕。 */}
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        <PeriodNav label={periodLabel(filter)} {...nav} />
        <div className="flex shrink-0 items-center gap-2">
          <LineIconButton icon="calendar" onClick={() => setModeOpen(true)} aria-label="選擇期間" title="選擇期間" />
          {actions}
        </div>
      </div>

      <Modal open={modeOpen} onClose={() => setModeOpen(false)} title="期間">
        <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
          {MODE_OPTIONS.map((opt) => {
            const active = filter.mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value);
                  setModeOpen(false);
                }}
                className={`px-4 py-3 text-left ${active ? "bg-[#F9F7FE]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${active ? "text-[#6F5FD6]" : "text-[#4A3B7C]"}`}>{opt.label}</span>
                  {active && <span className="text-xs font-semibold text-[#6F5FD6]">使用中</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* 天／週都是挑一個日期：天就是那一天，週是「那一天所在的那一週」。 */}
      {(filter.mode === "day" || filter.mode === "week") && (
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

      {/* granularity="month"：選年、選月兩步就結束，不會再跳到選日。 */}
      {filter.mode === "month" && (
        <DatePickerModal
          open={monthPickerOpen}
          granularity="month"
          initial={`${filter.year}-${pad2(filter.month)}`}
          onClose={() => setMonthPickerOpen(false)}
          onSave={(v) => {
            const [y, m] = v.split("-").map(Number);
            setFilter({ ...filter, year: y, month: m });
            setMonthPickerOpen(false);
          }}
        />
      )}

      {filter.mode === "custom" && (
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
      )}
    </>
  );
}

/** 只有一顆「2026/10 ‹ ›」的膠囊，沒有旁邊那顆日曆（換不了期間單位）。
 *
 *  ‹ › 一次換一個月，已經是本月時「下一月」變灰（還沒發生的月份沒東西可看）；點中間的
 *  日期開年月選擇器，只挑年跟月。模式永遠是「月」，選不到「全部」「年」或任意區間——
 *  首頁講的就是「這個月」（本月結餘、本月收入、本月預算支出），期間一換成別的單位，
 *  那些標題跟下面的數字立刻對不上。要看任意區間、看全部，請用報表頁。
 *
 *  跟 DateFilterPicker 的另一個差別是它不讀共用的 DateFilterContext，期間由呼叫端自己
 *  用 useState 拿著（見 dashboard-view.tsx）——首頁刻意跟其他頁各看各的月份：在報表頁
 *  翻到 2025/03 再回首頁，首頁該還是停在本月，不該被帶著走。 */
export function MonthFilterPicker({
  filter,
  onChange,
  className = "",
}: {
  filter: DateFilter;
  onChange: (f: DateFilter) => void;
  className?: string;
}) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // 「這個月」掛載時算一次固定住——render 當中讀時鐘是不純的。
  const [nowYearMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const atCurrentMonth = filter.year === nowYearMonth.year && filter.month === nowYearMonth.month;

  function goMonth(delta: number) {
    const d = new Date(filter.year, filter.month - 1 + delta, 1);
    onChange({ ...filter, mode: "month", year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  return (
    <div className={`flex justify-center ${className}`}>
      <PeriodNav
        label={periodLabel(filter)}
        onPrev={() => goMonth(-1)}
        onNext={() => goMonth(1)}
        nextDisabled={atCurrentMonth}
        onLabelClick={() => setMonthPickerOpen(true)}
      />
      {/* granularity="month"：選年、選月兩步就結束，不會再跳到選日。 */}
      <DatePickerModal
        open={monthPickerOpen}
        granularity="month"
        initial={`${filter.year}-${pad2(filter.month)}`}
        onClose={() => setMonthPickerOpen(false)}
        onSave={(value) => {
          const [y, m] = value.split("-").map(Number);
          onChange({ ...filter, mode: "month", year: y, month: m });
          setMonthPickerOpen(false);
        }}
      />
    </div>
  );
}
