// 純邏輯、不碰資料庫——CRUD 在同資料夾的 salary-records.server.ts（見 categories.ts 開頭的說明）。

import { shiftYearMonth, yearMonthOverlapsRange, type DateRange } from "./date-filter";
import { salaryItemTypeById, type SalaryItemTypeDTO } from "./salary-types";

export interface SalaryRecordItem {
  typeId: string;
  amount: number;
}

export interface SalaryRecordDTO {
  id: string;
  yearMonth: string;
  items: SalaryRecordItem[];
}

export function salaryRecordsInDateRange(records: SalaryRecordDTO[], range: DateRange | null): SalaryRecordDTO[] {
  return records.filter((r) => yearMonthOverlapsRange(r.yearMonth, range));
}

export function salaryNet(record: SalaryRecordDTO, types: SalaryItemTypeDTO[]): number {
  return record.items.reduce((sum, i) => {
    const type = salaryItemTypeById(types, i.typeId);
    return sum + (type?.kind === "扣項" ? -i.amount : i.amount);
  }, 0);
}

/** 年度薪資趨勢：回傳指定年份 1-12 月的淨額，沒有紀錄的月份算 0。 */
export function yearlySalaryTrend(
  records: SalaryRecordDTO[],
  types: SalaryItemTypeDTO[],
  year: number,
): { month: number; yearMonth: string; net: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const yearMonth = `${year}-${month}`;
    const record = records.find((r) => r.yearMonth === yearMonth);
    return { month: i + 1, yearMonth, net: record ? salaryNet(record, types) : 0 };
  });
}

export type SalaryCompareMode = "prevMonth" | "lastYearSameMonth" | "custom";

export interface SalaryCompareSelection {
  mode: SalaryCompareMode;
  customYearMonth?: string;
}

export function compareTargetYearMonth(yearMonth: string, selection: SalaryCompareSelection): string | null {
  if (selection.mode === "prevMonth") return shiftYearMonth(yearMonth, -1);
  if (selection.mode === "lastYearSameMonth") return shiftYearMonth(yearMonth, -12);
  return selection.customYearMonth && selection.customYearMonth !== yearMonth ? selection.customYearMonth : null;
}

export interface SalaryDelta {
  delta: number;
  pct: number | null;
  compareYearMonth: string;
}

/** 薪資比較：取代原本寫死只比上個月的做法，依 selection 決定要比較哪個月
 *  （上月／去年同月／自訂月份）；比較基準月份沒有薪資紀錄就回傳 null（沒東西可比）。 */
export function salaryDelta(
  records: SalaryRecordDTO[],
  types: SalaryItemTypeDTO[],
  yearMonth: string,
  selection: SalaryCompareSelection,
): SalaryDelta | null {
  const compareYearMonth = compareTargetYearMonth(yearMonth, selection);
  if (!compareYearMonth) return null;
  const current = records.find((r) => r.yearMonth === yearMonth);
  const compare = records.find((r) => r.yearMonth === compareYearMonth);
  if (!current || !compare) return null;
  const currentNet = salaryNet(current, types);
  const compareNet = salaryNet(compare, types);
  if (compareNet === 0) return { delta: currentNet - compareNet, pct: null, compareYearMonth };
  return { delta: currentNet - compareNet, pct: ((currentNet - compareNet) / compareNet) * 100, compareYearMonth };
}

export function salaryCompareLabel(selection: SalaryCompareSelection, compareYearMonth: string): string {
  if (selection.mode === "prevMonth") return "vs 上月";
  if (selection.mode === "lastYearSameMonth") return "vs 去年同月";
  return `vs ${compareYearMonth}`;
}
