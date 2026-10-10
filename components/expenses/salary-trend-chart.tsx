"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export interface TrendSeries {
  id: string;
  name: string;
  /** CSS 顏色值（直接吃 CSS 變數字串，例如 "var(--cat-c-fg)"）。 */
  color: string;
}

export interface TrendRow {
  month: number;
  yearMonth: string;
  [seriesId: string]: number | string;
}

const W = 640;
const H = 220;
const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 22;

export function SalaryTrendChart({ data, series }: { data: TrendRow[]; series: TrendSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const allValues = data.flatMap((row) => series.map((s) => Number(row[s.id]) || 0));
  const rawMax = Math.max(...allValues, 1);
  const niceMax = Math.max(10000, Math.ceil(rawMax / 10000) * 10000);
  const gridSteps = 4;

  const x = (i: number) => PAD_L + (plotW * i) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD_T + plotH - (v / niceMax) * plotH;
  const colWidth = plotW / Math.max(1, data.length - 1);

  const linePath = (seriesId: string) =>
    data.map((row, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(Number(row[seriesId]) || 0).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${series.map((s) => s.name).join("、")}的年度薪資淨額趨勢`}
      >
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const v = (niceMax / gridSteps) * i;
          const gy = y(v);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={gy} y2={gy} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD_L - 6} y={gy + 3} textAnchor="end" fontSize="9.5" fill="var(--muted)">
                {Math.round(v / 1000)}k
              </text>
            </g>
          );
        })}

        {data.map((row, i) => (
          <text key={row.yearMonth} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
            {row.month}
          </text>
        ))}

        {series.map((s) => (
          <path key={s.id} d={linePath(s.id)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T}
              y2={PAD_T + plotH}
              stroke="var(--muted)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {series.map((s) => (
              <circle
                key={s.id}
                cx={x(hover)}
                cy={y(Number(data[hover][s.id]) || 0)}
                r="5"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}
          </>
        )}

        {data.map((row, i) => (
          <rect
            key={row.yearMonth}
            x={x(i) - colWidth / 2}
            y={PAD_T}
            width={colWidth}
            height={plotH}
            fill="transparent"
            style={{ outline: "none" }}
            tabIndex={0}
            role="button"
            aria-label={`${row.month} 月`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
          />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-xs">
        {hover === null ? (
          <p className="text-muted">點選或觸碰圖表上的月份，看當月各成員的淨額。</p>
        ) : (
          <>
            <p className="font-semibold">{data[hover].month} 月</p>
            <div className="mt-1.5 flex flex-col gap-1">
              {series.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="tabular-nums font-semibold">{formatCurrency(Number(data[hover][s.id]) || 0)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
