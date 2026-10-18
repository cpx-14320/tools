import type { TrendPoint } from "@/lib/expenses/transactions";

const CHART_HEIGHT = 160;
// 長條上方那行金額佔掉的高度，長條本身要扣掉這段才不會頂出容器外。
const VALUE_LABEL_HEIGHT = 16;
const BAR_AREA = CHART_HEIGHT - VALUE_LABEL_HEIGHT;

/** 長條上方直接標金額——手機沒有滑鼠可以 hover 看 title，不標的話根本讀不出每根多少。
 *  欄位很窄（六期並排大概一欄 50px），完整的「NT$ 45,000」塞不下，所以萬元以上改用
 *  「4.5萬」這種縮寫，小數點後多餘的 0 去掉。 */
function compactAmount(n: number): string {
  if (n <= 0) return "";
  if (n >= 10000) {
    const wan = n / 10000;
    return `${wan >= 100 ? Math.round(wan) : Number(wan.toFixed(1))}萬`;
  }
  return n.toLocaleString("zh-TW");
}

/** 這一期相對前一期的增減百分比文字——長條的「高度差」在手機上很難目測出是差 8% 還是
 *  15%，標出來才讀得出趨勢。沒有前一期、或前一期是 0（沒有基準可以算比例）就不顯示。 */
function periodDelta(current: number, previous: number | undefined): { text: string; up: boolean } | null {
  if (previous === undefined || previous === 0 || current === previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  return { text: `${pct > 0 ? "▲" : "▼"}${Math.abs(pct)}%`, up: pct > 0 };
}

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
  selected,
  onSelect,
}: {
  points: TrendPoint[];
  series: TrendSeries[];
  formatValue: (n: number) => string;
  /** 目前展開細項的那一期（用 TrendPoint.start 當 key）；不傳就整張圖不可點。 */
  selected?: string | null;
  onSelect?: (start: string) => void;
}) {
  const maxTotal = Math.max(1, ...points.map((p) => p.total));

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {points.map((p) => {
          const isSelected = selected === p.start;
          return (
            <button
              key={p.start}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(p.start)}
              className={`flex flex-1 flex-col items-center justify-end rounded-lg transition-colors ${isSelected ? "bg-[#F3EFFC]" : ""}`}
              style={{ height: CHART_HEIGHT }}
              title={`${p.label}：${formatValue(p.total)}`}
            >
              <span className="mb-0.5 w-full truncate text-center text-[10px] font-medium tabular-nums text-[#4A3B7C]">
                {compactAmount(p.total)}
              </span>
              <div
                className="flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-md bg-[#F3EFFC]"
                style={{ height: Math.max(2, Math.round((p.total / maxTotal) * BAR_AREA)) }}
              >
                {series.map((s) => {
                  const amount = p.byCategory.find((b) => b.categoryId === s.id)?.amount ?? 0;
                  if (amount <= 0) return null;
                  return (
                    <div
                      key={s.id}
                      style={{ height: Math.max(2, Math.round((amount / maxTotal) * BAR_AREA)), background: s.colorHex }}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
      {/* 期間標籤底下再標一行「比前一期增減多少」——這是支出趨勢圖，花更多是 ▲（紅），
          花更少是 ▼（綠），跟 KPI 卡片的漲跌配色邏輯一致。 */}
      <div className="mt-2 flex gap-2">
        {points.map((p, i) => {
          const delta = periodDelta(p.total, points[i - 1]?.total);
          return (
            <div key={p.start} className="flex-1 overflow-hidden text-center">
              <span className="block truncate text-[10px] text-[#9C94C4]">{p.label}</span>
              {delta && (
                <span className="block truncate text-[10px] font-medium tabular-nums" style={{ color: delta.up ? "#D1517E" : "#2FAE82" }}>
                  {delta.text}
                </span>
              )}
            </div>
          );
        })}
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
  selected,
  onSelect,
}: {
  incomePoints: TrendPoint[];
  expensePoints: TrendPoint[];
  formatValue: (n: number) => string;
  /** 目前展開細項的那一期（用 TrendPoint.start 當 key）；不傳就整張圖不可點。 */
  selected?: string | null;
  onSelect?: (start: string) => void;
}) {
  const maxTotal = Math.max(1, ...incomePoints.map((p) => p.total), ...expensePoints.map((p) => p.total));

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {incomePoints.map((inc, i) => {
          const exp = expensePoints[i];
          const net = inc.total - exp.total;
          const isSelected = selected === inc.start;
          return (
            <button
              key={inc.start}
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(inc.start)}
              className={`flex flex-1 flex-col items-center justify-end rounded-lg transition-colors ${isSelected ? "bg-[#F3EFFC]" : ""}`}
              style={{ height: CHART_HEIGHT }}
            >
              {/* 兩根並排的欄位太窄，塞不下兩個數字，所以上面只標這一期的淨額
                  （收入－支出），那也正是這張圖真正想表達的東西。 */}
              <span
                className="mb-0.5 w-full truncate text-center text-[10px] font-medium tabular-nums"
                style={{ color: net < 0 ? NEGATIVE : POSITIVE }}
              >
                {net === 0 ? "" : `${net < 0 ? "－" : "＋"}${compactAmount(Math.abs(net))}`}
              </span>
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: BAR_AREA }}>
                <div
                  className="w-1/2 rounded-t-sm"
                  style={{ height: Math.max(2, Math.round((inc.total / maxTotal) * BAR_AREA)), background: POSITIVE }}
                  title={`收入 ${formatValue(inc.total)}`}
                />
                <div
                  className="w-1/2 rounded-t-sm"
                  style={{ height: Math.max(2, Math.round((exp.total / maxTotal) * BAR_AREA)), background: NEGATIVE }}
                  title={`支出 ${formatValue(exp.total)}`}
                />
              </div>
            </button>
          );
        })}
      </div>
      {/* 這張圖標的是淨額的增減：淨額變多是好事用綠色，變少用紅色，跟上面那行淨額同一套。 */}
      <div className="mt-2 flex gap-2">
        {incomePoints.map((inc, i) => {
          const net = inc.total - expensePoints[i].total;
          const prev = i > 0 ? incomePoints[i - 1].total - expensePoints[i - 1].total : undefined;
          const delta = periodDelta(net, prev);
          return (
            <div key={inc.start} className="flex-1 overflow-hidden text-center">
              <span className="block truncate text-[10px] text-[#9C94C4]">{inc.label}</span>
              {delta && (
                <span className="block truncate text-[10px] font-medium tabular-nums" style={{ color: delta.up ? POSITIVE : NEGATIVE }}>
                  {delta.text}
                </span>
              )}
            </div>
          );
        })}
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
