"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatMonthDay, formatShortDate } from "@/lib/freshwise/dates";
import { formatPriceIn, unitLabel } from "@/lib/freshwise/price";
import type { PricePoint, UnitKey } from "@/lib/freshwise/types";
import { colors, text } from "./theme";

// 歷史走勢圖。手刻 SVG，不裝圖表套件：這裡要的是一條單數列的折線＋一條平均線＋一個
// 十字準星，套件帶來的是一整包座標系統、動畫、主題與 100KB 以上的 bundle，划不來。
//
// 設計上照「單一數列」的規則走：
//   - 只有一個數列，所以不需要圖例（標題本身就說明了這條線是什麼）。
//   - 不在每個點上標數字，只直接標最高、最低與最後一個值（選擇性直接標示）。
//   - 格線與座標軸是背景資訊，顏色壓到最淡；資料線才是前景。
//   - 滑過／點按會出現十字準星與數值——HTML 的圖表本來就該是可互動的，不是一張圖片。
//
// viewBox 固定、寬度 100%：卡片寬度隨手機螢幕變，但座標計算用固定的 0–320 空間最單純。
// 線條用 vectorEffect="non-scaling-stroke"，縮放後線寬仍然是 2px，不會被拉粗。

const VIEW_W = 320;
const VIEW_H = 128;
/** 左右各留一點、上下留出標籤的空間。資料線不要貼著邊框畫，最高點的直接標示會被裁掉。 */
// bottom 要留得比 top 多：底下除了日期軸標籤，最低點的數字也畫在點的下方，兩者疊在
// 一起會變成「30」壓在「10/22」上面（實測 30 天與 7 天兩種區間都會發生）。
const PAD = { top: 16, right: 10, bottom: 28, left: 10 };

export function PriceChart({
  points,
  unit,
  /** 近一年均價。有給就畫一條虛線的參考線——「今天比平常貴還是便宜」是這個工具的核心
   *  問題，一條平均線就能讓使用者自己看出答案，比任何文字說明都快。 */
  averageKg,
  height = 160,
}: {
  points: PricePoint[];
  unit: UnitKey;
  averageKg?: number;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div className="grid place-items-center rounded-2xl" style={{ height, backgroundColor: colors.surfaceSoft }}>
        <p className={text.hint}>這段期間的資料不足，畫不出走勢</p>
      </div>
    );
  }

  const values = points.map((p) => p.avgKg);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // 上下各留 8% 的呼吸空間，而且不讓最小值貼著 0——菜價的變化幅度看的是「相對於自己」
  // 的起伏，從 0 開始畫會把所有波動壓成一條平線。折線圖不從 0 起算是可以的（長條圖就
  // 一定要），因為讀的是趨勢不是面積比較。
  const span = rawMax - rawMin || rawMax * 0.1 || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / (points.length - 1);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.avgKg).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;

  const maxIndex = values.indexOf(rawMax);
  const minIndex = values.indexOf(rawMin);
  const lastIndex = points.length - 1;
  const active = activeIndex === null ? null : points[activeIndex];

  /** 把手指／滑鼠的位置換算成最接近的資料點。用容器的實際寬度換算成 0–1 的比例再乘上
   *  點數，不用 SVG 座標——SVG 被縮放過，事件的座標是 CSS 像素。 */
  function pick(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    // 比例要先扣掉左右的留白，不然手指移到最左邊時會對不到第一個點。
    const plotRatio = Math.min(1, Math.max(0, (ratio * VIEW_W - PAD.left) / innerW));
    setActiveIndex(Math.round(plotRatio * (points.length - 1)));
  }

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        // 觸控時要擋掉預設的捲動，不然在圖上橫滑會變成捲頁面、準星跟著亂跳。
        style={{ touchAction: "pan-y" }}
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0) pick(e);
        }}
        onPointerUp={() => setActiveIndex(null)}
        onPointerCancel={() => setActiveIndex(null)}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height={height} role="img" aria-label="價格走勢圖">
          <defs>
            <linearGradient id="fw-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.brand} stopOpacity="0.22" />
              <stop offset="100%" stopColor={colors.brand} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 格線：三條水平線（最高、中間、最低），顏色壓到最淡。格線是用來估讀數值的
              輔助，不該跟資料線搶注意力。 */}
          {[0, 0.5, 1].map((t) => (
            <line
              key={t}
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={PAD.top + innerH * t}
              y2={PAD.top + innerH * t}
              stroke={colors.borderSoft}
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* 近一年均價的參考線（虛線，比資料線淡）。 */}
          {averageKg !== undefined && averageKg >= min && averageKg <= max && (
            <>
              <line
                x1={PAD.left}
                x2={VIEW_W - PAD.right}
                y1={y(averageKg)}
                y2={y(averageKg)}
                stroke={colors.faint}
                strokeWidth="1"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
              />
              <text x={PAD.left} y={y(averageKg) - 4} fontSize="7" fill={colors.faint}>
                平常價 {formatPriceIn(averageKg, unit)}
              </text>
            </>
          )}

          <path d={areaPath} fill="url(#fw-area)" />
          <path
            d={linePath}
            fill="none"
            stroke={colors.brand}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* 選擇性直接標示：只標最高、最低與最後一個值。每個點都標數字的話，三百多個
              點會疊成一團黑，什麼都讀不到。 */}
          <PointLabel x={x(maxIndex)} y={y(rawMax)} label={formatPriceIn(rawMax, unit)} place="above" />
          <PointLabel x={x(minIndex)} y={y(rawMin)} label={formatPriceIn(rawMin, unit)} place="below" />
          <circle cx={x(lastIndex)} cy={y(values[lastIndex])} r="3.5" fill={colors.brand} stroke="white" strokeWidth="1.5" />

          {/* 十字準星。只有手指／滑鼠真的在圖上時才出現。 */}
          {active && (
            <>
              <line
                x1={x(activeIndex as number)}
                x2={x(activeIndex as number)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke={colors.brand}
                strokeWidth="1"
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={x(activeIndex as number)} cy={y(active.avgKg)} r="4" fill="white" stroke={colors.brand} strokeWidth="2" />
            </>
          )}

          {/* 橫軸只標頭尾兩個日期。中間再多標幾個在 430px 寬的手機上一定會疊在一起。 */}
          <text x={PAD.left} y={VIEW_H - 5} fontSize="8" fill={colors.faint}>
            {formatMonthDay(points[0].date)}
          </text>
          <text x={VIEW_W - PAD.right} y={VIEW_H - 5} fontSize="8" fill={colors.faint} textAnchor="end">
            {formatMonthDay(points[lastIndex].date)}
          </text>
        </svg>
      </div>

      {/* 準星的數值用 HTML 畫在 SVG 上面，不是 SVG 的 <text>——文字樣式（字級、粗細、
          圓角底色）用 CSS 控制比 SVG 屬性好維護，而且不會被 viewBox 縮放。 */}
      {active && (
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-full px-3 py-1"
          style={{ backgroundColor: colors.ink }}
        >
          <span className="text-[11px] font-medium text-white">
            {formatShortDate(active.date)}　{formatPriceIn(active.avgKg, unit)} {unitLabel(unit)}
          </span>
        </div>
      )}
    </div>
  );
}

/** 最高／最低點旁邊的小數字。放在點的上面或下面，不要擋到資料線。 */
function PointLabel({ x, y, label, place }: { x: number; y: number; label: string; place: "above" | "below" }) {
  // 極值落在最左／最右時，置中的標籤會凸出 viewBox 被裁掉，所以貼邊時改成靠邊對齊。
  const anchor = x <= PAD.left + 12 ? "start" : x >= VIEW_W - PAD.right - 12 ? "end" : "middle";
  return (
    <>
      <circle cx={x} cy={y} r="2.5" fill={colors.brand} opacity="0.5" />
      <text
        x={anchor === "start" ? PAD.left : anchor === "end" ? VIEW_W - PAD.right : x}
        y={place === "above" ? y - 6 : y + 11}
        fontSize="8"
        fontWeight="600"
        fill={colors.muted}
        textAnchor={anchor}
      >
        {label}
      </text>
    </>
  );
}

/**
 * 迷你走勢（sparkline）。清單列與菜籃卡片裡「順便看一下這幾天的方向」用，不帶座標軸、
 * 不帶數值、不可互動——它的任務只是「上升還是下降」這一件事，加上任何標籤都只會讓
 * 那一列變擁擠。要讀數值的人會點進詳情頁。
 */
export function Sparkline({
  points,
  width = 64,
  height = 24,
  tone = "brand",
}: {
  points: PricePoint[];
  width?: number;
  height?: number;
  /** 依漲跌換色（漲紅跌綠），不指定就用品牌綠。 */
  tone?: "brand" | "up" | "down";
}) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.avgKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stroke = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.brand;

  // 上下各留 2px，不然最高最低點會被線寬切掉一半。
  const path = values
    .map((v, i) => {
      const px = (width * i) / (values.length - 1);
      const py = 2 + (height - 4) * (1 - (v - min) / span);
      return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
