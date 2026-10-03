"use client";

import { useState } from "react";
import { Card, CardBody, Badge, Button } from "@/components/ui";
import { commuteRoutes, modeMeta, weekdayLabel, type CommuteRoute, type Mode } from "@/lib/transit-mock-data";
import { AddCommuteModal } from "../add-commute-modal";
import { EditLegModal } from "./edit-leg-modal";

// 公車／火車／捷運／高鐵分開顯示，路線一多就不會變成一長串混在一起的列表。
const TAB_ORDER: Mode[] = ["Bus", "TRA", "Metro", "THSR"];

export function RoutesView() {
  const [mode, setMode] = useState<Mode>(TAB_ORDER[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CommuteRoute | null>(null);
  const rows = commuteRoutes.filter((r) => r.mode === mode);

  return (
    <div>
      <div className="mb-4">
        <Button onClick={() => setAddOpen(true)}>＋ 新增監控路線</Button>
      </div>

      <AddCommuteModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditLegModal route={editingRoute} onClose={() => setEditingRoute(null)} />

      <div className="mb-4 inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
        {TAB_ORDER.map((m) => {
          const meta = modeMeta[m];
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">{modeMeta[mode].label}目前沒有監控路線。</CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((route) => {
            const meta = modeMeta[route.mode];
            return (
              <Card key={route.id}>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${meta.bg} ${meta.fg}`}>
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{route.label}</p>
                        {!route.enabled && <Badge tone="future">已停用</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {route.originName} → {route.destName}・{route.routeKey}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
                    <div>
                      <dt className="uppercase tracking-wide">啟用日</dt>
                      <dd className="mt-0.5 text-ink">{weekdayLabel(route.activeWeekdays)}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">提前提醒</dt>
                      <dd className="mt-0.5 text-ink">{route.notifyBeforeMinutes} 分鐘</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">誤點門檻</dt>
                      <dd className="mt-0.5 text-ink">
                        {route.delayThresholdMinutes !== undefined ? `超過 ${route.delayThresholdMinutes} 分鐘` : "不適用"}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">通知管道</dt>
                      <dd className="mt-0.5 text-ink">Telegram</dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
                    <Button variant="ghost" className="text-xs">
                      {route.enabled ? "停用" : "啟用"}
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={() => setEditingRoute(route)}>
                      編輯
                    </Button>
                    <Button variant="ghost" className="text-xs text-negative hover:text-negative">
                      刪除
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
