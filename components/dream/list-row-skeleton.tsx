/** 清單資料還沒抓回來前，佔位用的一列骨架（圖示 + 幾行文字），給備忘錄／常用行程／
 *  其他頁的幾個清單共用，呼叫端自己決定要包在什麼容器（卡片／分隔清單的一列）裡。 */
export function ListRowSkeleton({ iconSize = 40, lines = 2 }: { iconSize?: number; lines?: number }) {
  return (
    <div className="flex animate-pulse items-center gap-3">
      <div className="shrink-0 rounded-xl bg-[#E4DBF9]" style={{ width: iconSize, height: iconSize }} />
      <div className="min-w-0 flex-1">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`h-3 rounded-full bg-[#E4DBF9] ${i > 0 ? "mt-1.5" : ""}`} style={{ width: i === 0 ? "70%" : "45%" }} />
        ))}
      </div>
    </div>
  );
}
