"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody, Button } from "@/components/ui";
import { modeMeta, type Mode } from "@/lib/transit-mock-data";

const MODES: Mode[] = ["TRA", "THSR", "Bus", "Metro"];
const WEEKDAYS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
];

export function NewRouteView() {
  const [mode, setMode] = useState<Mode>("TRA");
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const supportsDelay = mode === "TRA" || mode === "Metro";

  function toggleDay(day: number) {
    setActiveDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)));
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-4">
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
              <p className="mt-2 text-xs text-muted">高鐵準點率高、無可靠即時誤點資料，這條路線只會做時刻表查詢，不會推播誤點提醒。</p>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">路線名稱</span>
            <input
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="例如「上班通勤」"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{mode === "Bus" ? "起站牌" : "起站"}</span>
              <input
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={mode === "Bus" ? "例如「捷運市政府站」" : "例如「中壢」"}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{mode === "Bus" ? "迄站牌" : "迄站"}</span>
              <input
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={mode === "Bus" ? "例如「家樂福店」" : "例如「台北」"}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              {mode === "TRA" || mode === "THSR" ? "車次號（選填，不填則監控時間窗內所有列車）" : mode === "Bus" ? "公車路線名稱" : "捷運線別"}
            </span>
            <input
              className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              placeholder={mode === "TRA" ? "例如「2134」" : mode === "THSR" ? "例如「621」" : mode === "Bus" ? "例如「信義幹線」" : "例如「松山新店線」"}
            />
          </label>

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

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">提前幾分鐘提醒</span>
              <input
                type="number"
                defaultValue={10}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={`text-sm font-semibold ${supportsDelay ? "" : "text-muted"}`}>誤點超過幾分鐘才通知</span>
              <input
                type="number"
                defaultValue={5}
                disabled={!supportsDelay}
                className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand disabled:bg-surface-2 disabled:text-muted"
              />
            </label>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/tools/transit/routes" className="px-4 py-2 text-sm text-muted hover:text-ink">
          取消
        </Link>
        <Button>儲存</Button>
      </div>
    </div>
  );
}
