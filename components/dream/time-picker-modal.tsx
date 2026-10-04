"use client";

import { useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";

const HOUR_NUMBERS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTE_NUMBERS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const CLOCK_SIZE = 220;
const CLOCK_RADIUS = 84;
const CENTER = CLOCK_SIZE / 2;

// 12 個鐘面位置用三角函數算座標：index 0 放在正上方（12 點鐘方向），
// 跟 CSS rotate() 的角度公式剛好可以共用同一個 index*30-90。
function positionFor(index: number) {
  const angle = ((index * 30 - 90) * Math.PI) / 180;
  return {
    left: CENTER + CLOCK_RADIUS * Math.cos(angle),
    top: CENTER + CLOCK_RADIUS * Math.sin(angle),
  };
}

function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 };
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePickerModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const parsed = parseTime(initial);
  const [hour24, setHour24] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [stage, setStage] = useState<"hour" | "minute">("hour");
  const [viewMode, setViewMode] = useState<"clock" | "manual">("clock");

  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  // 圖形鐘面只能精確到 5 分鐘一格，指針先指到最近的那格；要分秒不差就切手動輸入。
  const minuteMark = minute - (minute % 5);

  function selectHour12(h12: number) {
    const next = isPM ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    setHour24(next);
    setStage("minute");
  }

  function setAmPm(pm: boolean) {
    if (pm === isPM) return;
    setHour24((h) => (pm ? (h + 12) % 24 : (h - 12 + 24) % 24));
  }

  const activeNumbers = stage === "hour" ? HOUR_NUMBERS : MINUTE_NUMBERS;
  const selectedIndex = stage === "hour" ? HOUR_NUMBERS.indexOf(hour12) : MINUTE_NUMBERS.indexOf(minuteMark);

  return (
    <BottomSheetModal
      open={open}
      title="選擇時間"
      onClose={onClose}
      bodyClassName="flex flex-col items-center gap-4 px-5 py-5"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(formatTime(hour24, minute))}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            確定
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStage("hour")}
          className={`rounded-xl px-2 py-1 text-3xl font-bold transition-colors ${
            stage === "hour" ? "bg-[#EFEAFC] text-[#6F5FD6]" : "text-[#4A3B7C]"
          }`}
        >
          {String(hour12).padStart(2, "0")}
        </button>
        <span className="text-3xl font-bold text-[#4A3B7C]">:</span>
        <button
          type="button"
          onClick={() => setStage("minute")}
          className={`rounded-xl px-2 py-1 text-3xl font-bold transition-colors ${
            stage === "minute" ? "bg-[#EFEAFC] text-[#6F5FD6]" : "text-[#4A3B7C]"
          }`}
        >
          {String(minute).padStart(2, "0")}
        </button>
        <div className="ml-2 flex flex-col gap-0.5 text-xs font-medium">
          <button type="button" onClick={() => setAmPm(false)} className={!isPM ? "text-[#6F5FD6]" : "text-[#D9D3F0]"}>
            上午
          </button>
          <button type="button" onClick={() => setAmPm(true)} className={isPM ? "text-[#6F5FD6]" : "text-[#D9D3F0]"}>
            下午
          </button>
        </div>
      </div>

      {viewMode === "clock" ? (
        <div className="relative" style={{ width: CLOCK_SIZE, height: CLOCK_SIZE }}>
          <div className="absolute inset-0 rounded-full bg-[#F6F3FD]" />
          <div
            aria-hidden
            className="absolute bg-[#D9CFF5]"
            style={{
              left: CENTER,
              top: CENTER,
              width: CLOCK_RADIUS - 18,
              height: 2,
              transformOrigin: "left center",
              transform: `rotate(${selectedIndex * 30 - 90}deg)`,
            }}
          />
          <div aria-hidden className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6F5FD6]" style={{ left: CENTER, top: CENTER }} />
          {activeNumbers.map((n, i) => {
            const pos = positionFor(i);
            const selected = stage === "hour" ? n === hour12 : n === minuteMark;
            return (
              <button
                key={n}
                type="button"
                onClick={() => (stage === "hour" ? selectHour12(n) : setMinute(n))}
                className={`absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-sm font-medium transition-colors ${
                  selected ? "bg-[#6F5FD6] text-white" : "text-[#4A3B7C] hover:bg-[#EFEAFC]"
                }`}
                style={{ left: pos.left, top: pos.top }}
              >
                {stage === "minute" ? String(n).padStart(2, "0") : n}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 py-6">
          <input
            type="number"
            min={0}
            max={23}
            value={hour24}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setHour24(Math.min(23, Math.max(0, v)));
            }}
            className="w-16 rounded-2xl border border-[#ECE4FA] px-3 py-2 text-center text-lg font-semibold text-[#4A3B7C] outline-none"
          />
          <span className="text-xl font-bold text-[#4A3B7C]">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setMinute(Math.min(59, Math.max(0, v)));
            }}
            className="w-16 rounded-2xl border border-[#ECE4FA] px-3 py-2 text-center text-lg font-semibold text-[#4A3B7C] outline-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setViewMode((v) => (v === "clock" ? "manual" : "clock"))}
        className="text-xs font-medium text-[#6F5FD6]"
      >
        {viewMode === "clock" ? "切換為手動輸入" : "切換為圖形選擇"}
      </button>
    </BottomSheetModal>
  );
}
