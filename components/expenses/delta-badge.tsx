import { formatCurrency } from "@/lib/format";

/** 「這期 vs 上一期」小標籤——花費類指標（上升=紅）請傳 goodWhenUp=false，
 *  收入類指標（上升=綠）傳 true。上一期沒資料時傳 null，這裡不渲染任何東西。 */
export function DeltaBadge({
  delta,
  pct,
  goodWhenUp,
  suffix = "vs 上期",
  className = "",
}: {
  delta: number;
  pct: number | null;
  goodWhenUp: boolean;
  suffix?: string;
  className?: string;
}) {
  const isUp = delta >= 0;
  const isGood = isUp === goodWhenUp;
  return (
    <p className={`text-xs font-medium tabular-nums ${isGood ? "text-[#2FAE82]" : "text-[#D1517E]"} ${className}`}>
      {isUp ? "▲" : "▼"} {formatCurrency(Math.abs(delta))}
      {pct !== null && (
        <>
          {" "}
          ({isUp ? "+" : "－"}
          {Math.abs(pct).toFixed(1)}%)
        </>
      )}{" "}
      {suffix}
    </p>
  );
}
