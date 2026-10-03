"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { modeMeta, type CommuteRoute, type Mode } from "@/lib/transit-mock-data";

const MODES: Mode[] = ["TRA", "Bus", "Metro", "THSR"];
const WEEKDAYS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
];

/** route 換了就要重新帶入表單值；用 key={route.id} 讓外層每次換一筆就整個重新掛載這個元件，
 *  state 的初始值直接從 props 算，不用額外寫 effect 去同步。 */
function EditLegForm({ route, onClose }: { route: CommuteRoute; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(route.mode);
  const [label, setLabel] = useState(route.label);
  const [origin, setOrigin] = useState(route.originName);
  const [dest, setDest] = useState(route.destName);
  const [notifyBeforeMinutes, setNotifyBeforeMinutes] = useState(String(route.notifyBeforeMinutes));
  const [delayThresholdMinutes, setDelayThresholdMinutes] = useState(String(route.delayThresholdMinutes ?? 5));
  const [activeDays, setActiveDays] = useState<number[]>(route.activeWeekdays);

  const supportsDelay = mode === "TRA" || mode === "Metro";

  function toggleDay(day: number) {
    setActiveDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)));
  }

  return (
    <div
      className="flex max-h-[88vh] w-full max-w-[430px] flex-col rounded-t-[1.75rem] bg-bg sm:max-h-[85vh] sm:rounded-[1.75rem]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="font-semibold">編輯「{route.label}」</p>
        <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">運輸工具</p>
            <div className="grid grid-cols-4 gap-2">
              {MODES.map((m) => {
                const meta = modeMeta[m];
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs transition-colors ${
                      active ? "border-brand bg-brand-soft text-brand font-medium" : "border-line bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {meta.icon}
                    </span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
            {mode === "THSR" && (
              <p className="mt-2 text-xs text-muted">高鐵準點率高、無可靠即時誤點資料，只會做時刻表查詢，不會推播誤點提醒。</p>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">路線名稱</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{mode === "Bus" ? "起站牌" : "起站"}</span>
              <input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{mode === "Bus" ? "迄站牌" : "迄站"}</span>
              <input
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">提前幾分鐘提醒</span>
              <input
                type="number"
                value={notifyBeforeMinutes}
                onChange={(e) => setNotifyBeforeMinutes(e.target.value)}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={`text-sm font-semibold ${supportsDelay ? "" : "text-muted"}`}>誤點超過幾分鐘才通知</span>
              <input
                type="number"
                value={delayThresholdMinutes}
                onChange={(e) => setDelayThresholdMinutes(e.target.value)}
                disabled={!supportsDelay}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand disabled:bg-surface-2 disabled:text-muted"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">提醒日</p>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((d) => {
                const active = activeDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`grid size-9 place-items-center rounded-full text-sm transition-colors ${
                      active ? "bg-brand text-brand-fg font-medium" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-ink">
          取消
        </button>
        <Button onClick={onClose}>儲存</Button>
      </div>
    </div>
  );
}

export function EditLegModal({ route, onClose }: { route: CommuteRoute | null; onClose: () => void }) {
  if (!route) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <EditLegForm key={route.id} route={route} onClose={onClose} />
    </div>
  );
}
