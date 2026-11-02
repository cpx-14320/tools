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

const UP_GOOD = "#2FAE82";
const UP_BAD = "#D1517E";

/** 差額要寫成金額還是百分比。由 YearPickerModal 決定（見 YearDeltaMode）。 */
export type YearDeltaMode = "amount" | "percent";

/** 同一列、跟基準年那一欄的差額。 */
function DeltaCell({
  current,
  previous,
  goodWhenUp,
  mode,
}: {
  current: number | null;
  previous: number | null;
  goodWhenUp: boolean;
  mode: YearDeltaMode;
}) {
  // 任一邊沒資料就不比：拿「還沒到的月份」當 0 去比，會算出一個看起來很嚇人的跌幅。
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return null;
  const isUp = diff > 0;
  // 基準是 0 的時候百分比沒有意義（除以 0），退回顯示金額而不是印出 ∞ 或空白——
  // 那一格本來就有差額，只是沒辦法用比例表示。
  const pct = previous === 0 ? null : (diff / Math.abs(previous)) * 100;
  const label = mode === "percent" && pct !== null ? `${Math.abs(pct).toFixed(0)}%` : formatCurrency(Math.abs(diff));
  return (
    <span className="mt-0.5 block text-[10px] font-medium tabular-nums" style={{ color: isUp === goodWhenUp ? UP_GOOD : UP_BAD }}>
      {isUp ? "▲" : "▼"} {label}
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
 *  差額一律是跟第一欄（基準年）比，不是跟左邊那一欄：挑三年以上時，「每一欄比它左邊
 *  多少」要在腦袋裡連續做兩次減法才知道跟基準差多少，而且基準年自己沒有差額可看。
 *  固定基準之後每一欄講的都是同一件事。基準年是哪一年由 YearPickerModal 決定。
 *
 *  年份一多就左右捲（月份那一欄 sticky 釘在左邊，捲到第四個年份還知道自己在看幾月）。 */
export function YearCompareTable({
  title,
  goodWhenUp,
  columns,
  deltaMode,
  onPickYears,
}: {
  title: string;
  /** 數字變大算好事還是壞事——支出變多是壞事（紅），收入／結餘／淨資產變多是好事（綠）。 */
  goodWhenUp: boolean;
  /** 第一欄是基準年，後面才是比較年（差額都是跟第一欄比）。 */
  columns: YearColumn[];
  /** 差額寫成金額還是百分比。 */
  deltaMode: YearDeltaMode;
  onPickYears: () => void;
}) {
  const cellClass = "whitespace-nowrap px-3 py-2 text-right align-top text-xs tabular-nums text-[#4A3B7C]";
  const totals = columns.map((c) => (c.values.some((v) => v !== null) ? c.values.reduce((sum: number, v) => sum + (v ?? 0), 0) : null));

  return (
    <Card>
      <CardBody>
        {/* 看哪個指標由頁面最上面那排分頁決定，這裡不再重複一組——同一頁兩組做同一件事
            的切換，只會讓人猜它們是不是各管各的。
            年份收進彈窗裡挑：攤在這裡的話，資料累積幾年之後這一排就會折成兩三排，
            把表格整個推下去（見 YearPickerModal）。 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={text.sectionHeading}>{title}</p>
          <button type="button" onClick={onPickYears} className="text-xs font-medium text-[#6F5FD6]">
            選擇年份
          </button>
        </div>

        {columns.length === 0 ? (
          <p className={`mt-4 ${text.muted}`}>還沒有可以比較的年份。</p>
        ) : (
          <div className="-mx-4 mt-4 overflow-x-auto px-4">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-[#F2EEFA]">
                  {/* sticky：年份多到要捲時，月份這一欄要釘住，不然捲到右邊就不知道
                      自己在看第幾個月。bg 要補上，不然捲過去的數字會透出來疊在上面。 */}
                  <th className="sticky left-0 z-10 bg-white px-1 py-2 text-left text-xs font-medium text-[#9C94C4]">月份</th>
                  {/* 第一欄就是基準年，標題不再另外寫「基準」兩個字：那是在選擇年份的
                      彈窗裡決定的，使用者剛設完就知道；每次看表都被提醒一次反而是雜訊。 */}
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
                              <DeltaCell current={v} previous={col > 0 ? columns[0].values[i] : null} goodWhenUp={goodWhenUp} mode={deltaMode} />
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* 合計這一列跟上面十二個月之間拉開一點（pt-4），看得出它是結論不是第十三
                    個月；底下不用留白，卡片自己的 padding 就到了。 */}
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-1 pb-0 pt-4 text-left align-top text-xs font-medium text-[#4A3B7C]">合計</th>
                  {totals.map((t, col) => (
                    <td key={columns[col].year} className={`${cellClass} px-3 pb-0 pt-4 font-semibold`}>
                      {t === null ? (
                        <span className="text-[#DDD6F3]">—</span>
                      ) : (
                        <>
                          {formatCurrency(t)}
                          {/* 合計的差額只在兩邊都已經過完整年時才有意義——今年才過到十月，
                              拿它的合計去比去年整年一定是「少很多」，那不是真的變少。 */}
                          <DeltaCell
                            current={columns[col].values.every((v) => v !== null) ? t : null}
                            previous={col > 0 && columns[0].values.every((v) => v !== null) ? totals[0] : null}
                            goodWhenUp={goodWhenUp}
                            mode={deltaMode}
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
