"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Badge, Button } from "@/components/ui";
import { TransitIllustration } from "@/components/illustrations";
import { AddCommuteModal } from "./add-commute-modal";
import {
  commuteRoutes,
  upcomingFor,
  modeMeta,
  weekdayLabel,
  type Direction,
  type Mode,
} from "@/lib/transit-mock-data";

// 跟 lib/tdx-client.ts 實測到的帳號額度一致：全帳號共用、每分鐘 5 次，不分運輸工具。
// 公車／台鐵每查一次現況要併打 2 個 TDX API（方向／誤點疊加），高鐵只需要時刻表，故只算 1 次。
const QUOTA_LIMIT = 5;
const QUOTA_WINDOW_MS = 60_000;
const CALL_COST: Record<Mode, number> = { Bus: 2, TRA: 2, Metro: 2, THSR: 1 };

type LegStatus = "unchecked" | "loading" | "checked" | "quota-blocked";

export function OverviewView() {
  const [addOpen, setAddOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("go");
  const [legStatus, setLegStatus] = useState<Record<string, LegStatus>>({});
  const [callLog, setCallLog] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());

  // 額度是隨時間流動的（過去 60 秒內的呼叫才算），每秒重新讀一次目前時間，讓額度顯示會自己恢復，
  // 不用使用者手動重置——Date.now() 這個不純的呼叫放在 effect 裡，不是直接在算繪時呼叫。
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const quotaUsed = callLog.filter((t) => now - t < QUOTA_WINDOW_MS).length;
  const quotaRemaining = Math.max(0, QUOTA_LIMIT - quotaUsed);

  const legs = commuteRoutes.filter((r) => r.direction === direction).sort((a, b) => a.legOrder - b.legOrder);

  /** 回傳這次實際花掉的額度（被擋下來就是 0）——checkAll 要在同一次點擊裡依序扣減，
   *  不能每段都讀同一個 quotaRemaining，否則同時查 3 段會因為沒跨渲染更新而全部通過。 */
  function attemptCheck(routeId: string, mode: Mode, available: number): number {
    const cost = CALL_COST[mode];
    if (cost > available) {
      setLegStatus((s) => ({ ...s, [routeId]: "quota-blocked" }));
      return 0;
    }
    setLegStatus((s) => ({ ...s, [routeId]: "loading" }));
    setCallLog((log) => [...log, ...Array(cost).fill(Date.now())]);
    setTimeout(() => {
      setLegStatus((s) => ({ ...s, [routeId]: "checked" }));
    }, 500);
    return cost;
  }

  function checkLeg(routeId: string, mode: Mode) {
    if (legStatus[routeId] === "loading") return;
    attemptCheck(routeId, mode, quotaRemaining);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-[1.75rem] p-5 text-brand"
        style={{ background: "linear-gradient(135deg, #E3E1FB, var(--lavender) 55%, var(--violet))" }}
      >
        <TransitIllustration className="pointer-events-none absolute right-0 top-0 h-full w-36 opacity-95" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{direction === "go" ? "啟程" : "返程"}・共 {legs.length} 段</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
            {quotaRemaining} / {QUOTA_LIMIT}
          </p>
          <p className="mt-1 text-xs opacity-80">本分鐘還能查的次數（全帳號共用，60 秒後慢慢恢復）</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
          {(["go", "back"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                direction === d ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
              }`}
            >
              {d === "go" ? "啟程" : "返程"}
            </button>
          ))}
        </div>

        <Button className="shrink-0 text-xs" onClick={() => setAddOpen(true)}>
          ＋ 新增路線
        </Button>
      </div>

      <AddCommuteModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="flex flex-col gap-3">
        {legs.map((route, i) => {
          const status = legStatus[route.id] ?? "unchecked";
          const upcoming = upcomingFor(route.id);
          const meta = modeMeta[route.mode];
          return (
            <Card key={route.id} className={route.enabled ? "" : "opacity-60"}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${meta.bg} ${meta.fg}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">第 {i + 1} 段</Badge>
                      <p className="font-semibold">{route.label}</p>
                      {!route.enabled && <Badge tone="future">已停用</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {route.originName} → {route.destName}・{route.routeKey}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{weekdayLabel(route.activeWeekdays)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  {status === "loading" ? (
                    <span className="text-xs text-muted">查詢中…（算 {CALL_COST[route.mode]} 次額度）</span>
                  ) : status === "quota-blocked" ? (
                    <span className="text-xs text-negative">本分鐘額度不夠（需要 {CALL_COST[route.mode]} 次），稍候再試</span>
                  ) : status === "checked" ? (
                    <span className="text-xs text-muted">已更新・顯示當下＋後兩班</span>
                  ) : (
                    <span className="text-xs text-muted">尚未查詢・需要 {CALL_COST[route.mode]} 次額度</span>
                  )}
                  <Button variant="secondary" className="shrink-0 text-xs" onClick={() => checkLeg(route.id, route.mode)}>
                    重整
                  </Button>
                </div>

                {status === "checked" && (
                  <div className="mt-2 flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
                    {upcoming.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-3.5">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-base ${meta.bg} ${meta.fg}`}>
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {row.time} <span className="text-muted">· {row.code}</span>
                          </p>
                          <p className="truncate text-xs text-muted">
                            {row.destName}
                            {row.note ? `・${row.note}` : ""}
                          </p>
                        </div>
                        {row.delayMinutes !== undefined && (
                          <Badge tone={row.delayMinutes > 0 ? "negative" : "positive"}>
                            {row.delayMinutes > 0 ? `誤點 ${row.delayMinutes} 分` : "準點"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
