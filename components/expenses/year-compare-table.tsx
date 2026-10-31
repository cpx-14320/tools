"use client";

import { Card, CardBody } from "./card";
import { ChoiceChip } from "./button";
import { text } from "./theme";
import { formatCurrency } from "@/lib/format";

/** 一欄＝一個年份，values 是 1～12 月的數字；null 代表那個月還沒到，表格上留空白
 *  （跟「那個月是 0」要分得出來）。 */
export interface YearColumn {
  year: number;
  values: (number | null)[];
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

const UP_GOOD = "#2FAE82";
const UP_BAD = "#D1517E";

/** 同一列、跟左邊那一欄（前一個年份）的差額。 */
function DeltaCell({ current, previous, goodWhenUp }: { current: number | null; previous: number | null; goodWhenUp: boolean }) {
  // 任一邊沒資料就不比：拿「還沒到的月份」當 0 去比，會算出一個看起來很嚇人的跌幅。
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const isUp = diff > 0;
  return (
    <span className="mt-0.5 block text-[10px] font-medium tabular-nums" style={{ color: isUp === goodWhenUp ? UP_GOOD : UP_BAD }}>
      {isUp ? "▲" : "▼"} {formatCurrency(Math.abs(diff))}
    </span>
  );
}

/** 年度對照表——同一個指標、好幾個年份並排，一格一個數字，數字底下再掛一行「比左邊那
 *  一年多／少多少」。
 *
 *  看哪個指標（支出／收入／結餘／淨資產）由頁面最上面那排分頁決定，表格自己不帶切換。
 *
 *  刻意只有數字、沒有圖：上面的趨勢圖已經負責「看走勢」，這張表負責的是另一件事——
 *  「2025 年 3 月到底是多少、跟今年差多少」。那種問題看長條圖是答不出來的。
 *
 *  差額是跟「左邊那一欄」比，不是固定跟第一欄比：欄位照年份由舊到新排，所以每一格
 *  講的都是「比前一年多／少多少」，挑三年以上時每一欄都有意義。
 *
 *  年份一多就左右捲（月份那一欄 sticky 釘在左邊，捲到第四個年份還知道自己在看幾月）。 */
export function YearCompareTable({
  title,
  goodWhenUp,
  columns,
  availableYears,
  selectedYears,
  onToggleYear,
}: {
  title: string;
  /** 數字變大算好事還是壞事——支出變多是壞事（紅），收入／結餘／淨資產變多是好事（綠）。 */
  goodWhenUp: boolean;
  columns: YearColumn[];
  availableYears: number[];
  selectedYears: number[];
  onToggleYear: (year: number) => void;
}) {
  const cellClass = "whitespace-nowrap px-3 py-2 text-right align-top text-xs tabular-nums text-[#4A3B7C]";
  const totals = columns.map((c) => (c.values.some((v) => v !== null) ? c.values.reduce((sum: number, v) => sum + (v ?? 0), 0) : null));

  return (
    <Card>
      <CardBody>
        {/* 看哪個指標由頁面最上面那排分頁決定，這裡不再重複一組——同一頁兩組做同一件事
            的切換，只會讓人猜它們是不是各管各的。 */}
        <p className={text.sectionHeading}>{title}</p>

        {/* 年份可以複選——兩年對比最常用，但「今年 vs 前兩年」這種看長期變化的需求
            一樣成立，沒道理限制成只能挑兩個。 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {availableYears.map((y) => {
            const active = selectedYears.includes(y);
            return (
              <ChoiceChip key={y} active={active} onClick={() => onToggleYear(y)}>
                {y}
              </ChoiceChip>
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
                    <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left align-top text-xs font-normal text-[#9C94C4]">{label}</th>
                    {columns.map((c, col) => {
                      const v = c.values[i];
                      return (
                        <td key={c.year} className={cellClass}>
                          {/* 還沒到的月份留空白，不要填 0 —— 0 會被讀成「那個月沒花錢」。 */}
                          {v === null ? (
                            <span className="text-[#DDD6F3]">—</span>
                          ) : (
                            <>
                              {formatCurrency(v)}
                              <DeltaCell current={v} previous={col > 0 ? columns[col - 1].values[i] : null} goodWhenUp={goodWhenUp} />
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left align-top text-xs font-medium text-[#4A3B7C]">合計</th>
                  {totals.map((t, col) => (
                    <td key={columns[col].year} className={`${cellClass} font-semibold`}>
                      {t === null ? (
                        <span className="text-[#DDD6F3]">—</span>
                      ) : (
                        <>
                          {formatCurrency(t)}
                          {/* 合計的差額只在兩邊都已經過完整年時才有意義——今年才過到十月，
                              拿它的合計去比去年整年一定是「少很多」，那不是真的變少。 */}
                          <DeltaCell
                            current={columns[col].values.every((v) => v !== null) ? t : null}
                            previous={col > 0 && columns[col - 1].values.every((v) => v !== null) ? totals[col - 1] : null}
                            goodWhenUp={goodWhenUp}
                          />
                        </>
                      )}
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
