/** 中空圓餅圖——用 SVG <circle> 的 stroke-dasharray 畫弧段，pathLength=100 讓百分比可以
 *  直接當 dasharray 數值用，不用自己算弧長。各段緊鄰、不留空隙，用平直端（butt）切開
 *  （不要圓端），看起來是直線切一刀、不是圓弧收邊——比照參考圖（記帳本參考資料夾）的
 *  圓餅圖樣式。呼應分類佔比卡片既有的「色塊＋名稱＋%」列表，色彩是同一組分類顏色，
 *  不是另外配的。不放中心文字——總額已經在上面的大數字卡顯示過一次，圖表本身只負責
 *  呈現「各佔多少」。 */
export interface DonutSlice {
  id: string;
  label: string;
  amount: number;
  colorHex: string;
}

export function DonutChart({ data, size = 140, thickness = 42 }: { data: DonutSlice[]; size?: number; thickness?: number }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const radius = (size - thickness) / 2;

  if (total <= 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="目前沒有資料">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3EFFC" strokeWidth={thickness} />
      </svg>
    );
  }

  // 先把每段的起始角度（百分比）算成一個陣列，再用純粹的 .map 產生 JSX——不要在
  // 產生 JSX 的那個 .map 裡順便累加變數，累加這件事單獨用 reduce 做完，兩段邏輯不混在一起。
  const segments = data.reduce<{ slice: DonutSlice; pct: number; offset: number }[]>((acc, slice) => {
    const pct = (slice.amount / total) * 100;
    const prevEnd = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ slice, pct, offset: prevEnd });
    return acc;
  }, []);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="分類佔比圖">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map(({ slice, pct, offset }) => (
          <circle
            key={slice.id}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.colorHex}
            strokeWidth={thickness}
            strokeLinecap="butt"
            pathLength={100}
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={-offset}
          >
            <title>{`${slice.label} ${pct.toFixed(1)}%`}</title>
          </circle>
        ))}
      </g>
    </svg>
  );
}
