import type { TrendPoint } from "@/lib/expenses/transactions";

const CHART_HEIGHT = 160;

export interface TrendSeries {
  id: string;
  label: string;
  colorHex: string;
}

/** 堆疊長條圖——用固定高度容器＋像素高度計算每段的高度，不是巢狀百分比（巢狀算起來
 *  容易因為四捨五入兜不整，固定像素高度比較好對齊）。段與段之間留 1px 間隙
 *  （flex gap），整根長條的頂端用 overflow-hidden + rounded-t-md 做出圓角，不用對
 *  每一段分別處理圓角。series 的顏色／順序由呼叫端決定並保持固定，不會因為某一期
 *  缺資料就重新排序——同一個分類在每一根長條裡永遠是同一個顏色、同一個位置。 */
export function TrendBarChart({
  points,
  series,
  formatValue,
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  formatValue: (n: number) => string;
}) {
  const maxTotal = Math.max(1, ...points.map((p) => p.total));

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {points.map((p) => (
          <div
            key={p.start}
            className="flex flex-1 flex-col items-center justify-end"
            style={{ height: CHART_HEIGHT }}
            title={`${p.label}：${formatValue(p.total)}`}
          >
            <div
              className="flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-md bg-[#F3EFFC]"
              style={{ height: Math.max(2, Math.round((p.total / maxTotal) * CHART_HEIGHT)) }}
            >
              {series.map((s) => {
                const amount = p.byCategory.find((b) => b.categoryId === s.id)?.amount ?? 0;
                if (amount <= 0) return null;
                return (
                  <div
                    key={s.id}
                    style={{ height: Math.max(2, Math.round((amount / maxTotal) * CHART_HEIGHT)), background: s.colorHex }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {points.map((p) => (
          <span key={p.start} className="flex-1 truncate text-center text-[10px] text-[#9C94C4]">
            {p.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-[#4A3B7C]">
            <span className="size-2 shrink-0 rounded-full" style={{ background: s.colorHex }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const POSITIVE = "#2FAE82";
const NEGATIVE = "#D1517E";

/** 淨額用的收入／支出對照長條——故意不跟 TrendBarChart 共用同一個元件：堆疊起來會把
 *  收入＋支出加在一起，數字本身就是誤導的（一個是進帳、一個是花費，不該疊成同一截）。
 *  改用「同一期兩根並排的長條」直接對照，比較符合「淨額＝收入－支出」這個意思。 */
export function NetTrendChart({
  incomePoints,
  expensePoints,
  formatValue,
}: {
  incomePoints: TrendPoint[];
  expensePoints: TrendPoint[];
  formatValue: (n: number) => string;
}) {
  const maxTotal = Math.max(1, ...incomePoints.map((p) => p.total), ...expensePoints.map((p) => p.total));

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {incomePoints.map((inc, i) => {
          const exp = expensePoints[i];
          return (
            <div key={inc.start} className="flex flex-1 flex-col items-center justify-end" style={{ height: CHART_HEIGHT }}>
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: CHART_HEIGHT }}>
                <div
                  className="w-1/2 rounded-t-sm"
                  style={{ height: Math.max(2, Math.round((inc.total / maxTotal) * CHART_HEIGHT)), background: POSITIVE }}
                  title={`收入 ${formatValue(inc.total)}`}
                />
                <div
                  className="w-1/2 rounded-t-sm"
                  style={{ height: Math.max(2, Math.round((exp.total / maxTotal) * CHART_HEIGHT)), background: NEGATIVE }}
                  title={`支出 ${formatValue(exp.total)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {incomePoints.map((p) => (
          <span key={p.start} className="flex-1 truncate text-center text-[10px] text-[#9C94C4]">
            {p.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A3B7C]">
          <span className="size-2 rounded-full" style={{ background: POSITIVE }} />
          收入
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A3B7C]">
          <span className="size-2 rounded-full" style={{ background: NEGATIVE }} />
          支出
        </span>
      </div>
    </div>
  );
}
