/** 淡紫底軌道＋實心填色的進度條——原本只有存錢目標在用（goals-view.tsx 內嵌一份），
 *  固定收支要顯示「已確認幾期 / 總期數」也是同一種樣式，所以抽成共用元件。tone="positive"
 *  給「已達成／已完成」狀態用綠色，其餘情境維持品牌紫。 */
export function ProgressBar({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "positive" }) {
  const fillClass = tone === "positive" ? "bg-[#2FAE82]" : "bg-[#6F5FD6]";
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[#F3EFFC]">
      <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
