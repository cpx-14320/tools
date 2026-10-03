"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { modeMeta, type Mode } from "@/lib/transit-mock-data";

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

type Direction = "go" | "back";

interface DirectionFields {
  origin: string;
  dest: string;
  notifyBeforeMinutes: string;
  delayThresholdMinutes: string;
}

const emptyDirection: DirectionFields = { origin: "", dest: "", notifyBeforeMinutes: "10", delayThresholdMinutes: "5" };

export function AddCommuteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("TRA");
  const [direction, setDirection] = useState<Direction>("go");
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [go, setGo] = useState<DirectionFields>(emptyDirection);
  const [back, setBack] = useState<DirectionFields>(emptyDirection);

  if (!open) return null;

  const supportsDelay = mode === "TRA" || mode === "Metro";
  const fields = direction === "go" ? go : back;
  const setFields = direction === "go" ? setGo : setBack;

  function toggleDay(day: number) {
    setActiveDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)));
  }

  /** 返程常常就是啟程反過來，這裡幫忙帶入一次，使用者還是可以自己改。 */
  function copyReversedFromGo() {
    setBack({ ...back, origin: go.dest, dest: go.origin });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-[430px] flex-col rounded-t-[1.75rem] bg-bg sm:max-h-[85vh] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="font-semibold">新增通勤路線</p>
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
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="例如「上班通勤」，啟程／返程共用這個名稱"
              />
            </label>

            <div className="inline-flex items-center gap-1 self-start rounded-full border border-line bg-surface p-1">
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

            {direction === "back" && (
              <button type="button" onClick={copyReversedFromGo} className="self-start text-xs font-medium text-brand hover:underline">
                ↺ 從啟程帶入（起訖站互換）
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">{mode === "Bus" ? "起站牌" : "起站"}</span>
                <input
                  value={fields.origin}
                  onChange={(e) => setFields({ ...fields, origin: e.target.value })}
                  className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                  placeholder={mode === "Bus" ? "例如「捷運市政府站」" : "例如「中壢」"}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">{mode === "Bus" ? "迄站牌" : "迄站"}</span>
                <input
                  value={fields.dest}
                  onChange={(e) => setFields({ ...fields, dest: e.target.value })}
                  className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                  placeholder={mode === "Bus" ? "例如「家樂福店」" : "例如「台北」"}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">提前幾分鐘提醒</span>
                <input
                  type="number"
                  value={fields.notifyBeforeMinutes}
                  onChange={(e) => setFields({ ...fields, notifyBeforeMinutes: e.target.value })}
                  className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={`text-sm font-semibold ${supportsDelay ? "" : "text-muted"}`}>誤點超過幾分鐘才通知</span>
                <input
                  type="number"
                  value={fields.delayThresholdMinutes}
                  onChange={(e) => setFields({ ...fields, delayThresholdMinutes: e.target.value })}
                  disabled={!supportsDelay}
                  className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand disabled:bg-surface-2 disabled:text-muted"
                />
              </label>
            </div>
            <p className="text-xs text-muted">啟程／返程的起訖站、提醒設定各自獨立，切換上面的 tab 就能分別填。</p>

            <div>
              <p className="mb-2 text-sm font-semibold">提醒日（啟程／返程共用）</p>
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
    </div>
  );
}
