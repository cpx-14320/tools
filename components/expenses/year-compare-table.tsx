"use client";

import { Card, CardBody } from "./card";
import { text } from "./theme";
import { formatCurrency } from "@/lib/format";

/** 一欄＝一個年份，values 是 1～12 月的數字；null 代表那個月還沒到，表格上留空白
 *  （跟「那個月是 0」要分得出來）。 */
export interface YearColumn {
  year: number;
  values: (number | null)[];
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

/** 年度對照表——同一個指標、好幾個年份並排，一格一個數字。
 *
 *  刻意只有數字、沒有圖：上面的趨勢圖已經負責「看走勢」，這張表負責的是另一件事——
 *  「2025 年 3 月到底是多少、跟今年差多少」。那種問題看長條圖是答不出來的，得有精確
 *  數值並排才比得了。
 *
 *  年份一多就左右捲（月份那一欄 sticky 釘在左邊，捲到第四個年份還知道自己在看幾月）。 */
export function YearCompareTable({
  title,
  columns,
  availableYears,
  selectedYears,
  onToggleYear,
}: {
  title: string;
  columns: YearColumn[];
  availableYears: number[];
  selectedYears: number[];
  onToggleYear: (year: number) => void;
}) {
  const cellClass = "whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums text-[#4A3B7C]";

  return (
    <Card>
      <CardBody>
        <p className={text.sectionHeading}>{title}</p>

        {/* 年份可以複選——兩年對比最常用，但「今年 vs 前兩年」這種看長期變化的需求
            一樣成立，沒道理限制成只能挑兩個。 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {availableYears.map((y) => {
            const active = selectedYears.includes(y);
            return (
              <button
                key={y}
                type="button"
                onClick={() => onToggleYear(y)}
                className={`rounded-full px-3 py-1 text-xs font-medium tabular-nums transition-colors ${
                  active ? "bg-[#6F5ED4] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"
                }`}
              >
                {y}
              </button>
            );
          })}
        </div>

        {columns.length === 0 ? (
          <p className={`mt-4 ${text.muted}`}>挑一個以上的年份來比較。</p>
        ) : (
          <div className="-mx-4 mt-4 overflow-x-auto px-4">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-[#F2EEFA]">
                  {/* sticky：年份多到要捲時，月份這一欄要釘住，不然捲到右邊就不知道
                      自己在看第幾個月。bg 要補上，不然捲過去的數字會透出來疊在上面。 */}
                  <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left text-xs font-medium text-[#9C94C4]">月份</th>
                  {columns.map((c) => (
                    <th key={c.year} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-[#4A3B7C]">
                      {c.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MONTH_LABELS.map((label, i) => (
                  <tr key={label} className="border-b border-[#F2EEFA]">
                    <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left text-xs font-normal text-[#9C94C4]">{label}</th>
                    {columns.map((c) => {
                      const v = c.values[i];
                      return (
                        <td key={c.year} className={cellClass}>
                          {/* 還沒到的月份留空白，不要填 0 —— 0 會被讀成「那個月沒花錢」。 */}
                          {v === null ? <span className="text-[#DDD6F3]">—</span> : formatCurrency(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left text-xs font-medium text-[#4A3B7C]">合計</th>
                  {columns.map((c) => (
                    <td key={c.year} className={`${cellClass} font-semibold`}>
                      {formatCurrency(c.values.reduce((sum: number, v) => sum + (v ?? 0), 0))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
