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

/** KPI 卡片：標籤跟漲跌幅同一行（標籤左、漲跌幅右），金額自己獨立一行在下面——
 *  漲跌幅緊貼大數字那排的話，百分比一大（例如 ▲850%）就會跟金額擠在一起、甚至把
 *  數字擠到換行；跟小標題同一排右對齊，不管百分比多長都不影響金額本身的排版，
 *  也統一跟其他小標題區塊（資產/負債小標旁邊放操作、首頁卡片旁邊放「查看全部」）
 *  同一種「小標左、附加資訊右」的版型。總覽頁（本月收入/支出/結餘）跟資產總表
 *  （淨資產/資產/負債）共用同一套樣式，不要兩邊各自手刻。 */
export function KpiCard({
  label,
  value,
  valueColor,
  delta,
  action,
}: {
  label: string;
  value: string;
  valueColor: string;
  delta?: ReactNode;
  /** 金額右邊的操作按鈕（目前只有首頁結餘卡的隱藏金額眼睛）。跟金額同一行，不是另外
   *  一列，不然這張卡會為了一顆小按鈕多長一截。 */
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className={text.muted}>{label}</p>
          {delta}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-lg font-bold tabular-nums" style={{ color: valueColor }}>
            {value}
          </p>
          {action}
        </div>
      </CardBody>
    </Card>
  );
}
