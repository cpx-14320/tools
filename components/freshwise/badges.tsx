"use client";

import { Badge } from "./ui";
import { colors } from "./theme";
import { trendLabel, VALUE_LABEL, type Trend, type ValueJudgement } from "@/lib/freshwise/price";
import type { ValueLevel } from "@/lib/freshwise/types";

// 這個工具特有的四種徽章。放在獨立檔案（不是 ui.tsx）是因為它們帶著商業含意——「什麼
// 叫漲、什麼叫划算」是 lib/freshwise/price.ts 決定的，這裡只負責把那個判定畫成對應的
// 顏色。ui.tsx 裡的 Badge 只管形狀。
//
// 配色規則：
//   - 漲＝紅、跌＝綠（台灣看盤的習慣；對買菜的人來說綠色剛好也是好消息）。
//   - 划算＝綠底綠字、偏貴＝紅底紅字、正常價＝淡灰綠（正常價不該搶注意力）。
//   - 當季＝土黃（跟漲跌的紅綠分開，避免被誤讀成價格訊號）。
//   - 估算＝無彩度的淡底，看起來就是「這不是實測值」。

/** 漲跌徽章。持平時預設不顯示——一整頁都是「持平」的灰色徽章只是視覺雜訊，真正該被
 *  注意的漲跌反而不明顯。需要固定佔位（例如表格對齊）時才傳 showFlat。 */
export function TrendBadge({ trend, showFlat = false, size = "md" }: { trend: Trend; showFlat?: boolean; size?: "md" | "sm" }) {
  if (trend.direction === "flat" && !showFlat) return null;

  const palette =
    trend.direction === "up"
      ? { bg: colors.upBg, fg: colors.up }
      : trend.direction === "down"
        ? { bg: colors.downBg, fg: colors.down }
        : { bg: colors.surfaceSoft, fg: colors.muted };

  return (
    <Badge size={size} style={{ backgroundColor: palette.bg, color: palette.fg }}>
      {trendLabel(trend)}
    </Badge>
  );
}

const VALUE_PALETTE: Record<ValueLevel, { bg: string; fg: string }> = {
  cheap: { bg: colors.downBg, fg: colors.down },
  fair: { bg: colors.surfaceSoft, fg: colors.muted },
  pricey: { bg: colors.upBg, fg: colors.up },
};

/** 划算度徽章（划算／正常價／偏貴）。 */
export function ValueBadge({ value, showFair = false }: { value: ValueJudgement; showFair?: boolean }) {
  if (value.level === "fair" && !showFair) return null;
  const palette = VALUE_PALETTE[value.level];
  return (
    <Badge style={{ backgroundColor: palette.bg, color: palette.fg }}>
      {VALUE_LABEL[value.level]}
    </Badge>
  );
}

/** 當季徽章。 */
export function SeasonBadge() {
  return <Badge style={{ backgroundColor: colors.warningBg, color: colors.warning }}>當季</Badge>;
}

/** 估算值徽章。超市量販那一欄一定要帶這個——那個數字是推估的，不是實際訪價，不標清楚
 *  就等於拿推估值冒充實測值（理由見 lib/freshwise/types.ts 的 VenueKey）。 */
export function EstimatedBadge() {
  return <Badge style={{ backgroundColor: colors.surfaceSoft, color: colors.muted }}>估算</Badge>;
}
