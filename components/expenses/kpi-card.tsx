import type { ReactNode } from "react";
import { Card, CardBody } from "./card";
import { text } from "./theme";

export const KPI_POSITIVE = "#2FAE82";
export const KPI_NEGATIVE = "#D1517E";

/** 「較上期 +N%」小字，緊接在金額後面同一行——收入類指標上升是好事用綠色，支出類指標
 *  上升是壞事用珊瑚紅，跟搭乘車 etaToneStyle 那套「依狀態決定色調」是同一個精神，只是
 *  這裡依漲跌方向決定。 */
export function DeltaText({ delta, pct, goodWhenUp }: { delta: number; pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return null;
  const isUp = delta >= 0;
  const isGood = isUp === goodWhenUp;
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: isGood ? KPI_POSITIVE : KPI_NEGATIVE }}>
      {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** KPI 卡片：標籤在上、金額＋漲跌幅同一行在下，不放圖示——總覽頁（本月收入/支出/結餘）
 *  跟資產總表（淨資產/資產/負債）共用同一套樣式，不要兩邊各自手刻。 */
export function KpiCard({ label, value, valueColor, delta }: { label: string; value: string; valueColor: string; delta?: ReactNode }) {
  return (
    <Card>
      <CardBody className="p-3">
        <p className={text.muted}>{label}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <p className="text-lg font-bold tabular-nums" style={{ color: valueColor }}>
            {value}
          </p>
          {delta}
        </div>
      </CardBody>
    </Card>
  );
}
