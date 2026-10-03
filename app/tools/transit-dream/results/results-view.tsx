"use client";

import Link from "next/link";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";

export type Mode = "bus" | "train" | "metro" | "thsr";

const MODE_META: Record<Mode, { label: string; icon: string }> = {
  train: { label: "火車", icon: ICON_PATHS.modeTrain },
  thsr: { label: "高鐵", icon: ICON_PATHS.modeThsr },
  bus: { label: "公車", icon: ICON_PATHS.modeBus },
  metro: { label: "捷運", icon: ICON_PATHS.modeMetro },
};

const TRAIN_STYLE: Record<string, string> = {
  自強: "bg-[#FBE3E8] text-[#D1517E]",
  莒光: "bg-[#FDE7D8] text-[#D97A3D]",
  區間: "bg-[#DCEAFC] text-[#3B6FD1]",
};

const MODE_STYLE: Record<Mode, string> = {
  train: "",
  thsr: "bg-[#F3E8FC] text-[#9A5FD6]",
  bus: "bg-[#E3F6EC] text-[#2FAE82]",
  metro: "bg-[#E6EEFC] text-[#4E7FE0]",
};

function badgeClass(mode: Mode, code: string) {
  if (mode === "train") {
    const [trainType] = code.split(" ");
    return TRAIN_STYLE[trainType];
  }
  return MODE_STYLE[mode];
}

interface ResultRow {
  time: string;
  arrive: string;
  code: string;
  duration: string;
  stops: number;
  price: string;
}

// 之後串 API 就是把每個車種這份清單換成依 origin/dest/mode 查回來的真班次，列表呈現方式不用變。
const RESULTS_BY_MODE: Record<Mode, ResultRow[]> = {
  train: [
    { time: "06:28", arrive: "08:36", code: "自強 110", duration: "2 小時 8 分", stops: 3, price: "NT$ 650" },
    { time: "07:15", arrive: "09:01", code: "莒光 502", duration: "1 小時 46 分", stops: 5, price: "NT$ 450" },
    { time: "08:02", arrive: "10:28", code: "區間 2124", duration: "2 小時 26 分", stops: 12, price: "NT$ 300" },
    { time: "09:12", arrive: "11:20", code: "自強 272", duration: "2 小時 8 分", stops: 3, price: "NT$ 650" },
    { time: "10:30", arrive: "12:16", code: "莒光 510", duration: "1 小時 46 分", stops: 5, price: "NT$ 450" },
  ],
  thsr: [
    { time: "06:30", arrive: "08:06", code: "605", duration: "1 小時 36 分", stops: 4, price: "NT$ 1,490" },
    { time: "07:30", arrive: "09:00", code: "607", duration: "1 小時 30 分", stops: 3, price: "NT$ 1,490" },
    { time: "08:30", arrive: "10:12", code: "609", duration: "1 小時 42 分", stops: 5, price: "NT$ 1,490" },
    { time: "09:30", arrive: "11:00", code: "611", duration: "1 小時 30 分", stops: 3, price: "NT$ 1,490" },
    { time: "10:30", arrive: "12:06", code: "613", duration: "1 小時 36 分", stops: 4, price: "NT$ 1,490" },
  ],
  bus: [
    { time: "06:00", arrive: "07:10", code: "1861", duration: "1 小時 10 分", stops: 8, price: "NT$ 90" },
    { time: "07:00", arrive: "08:15", code: "1861", duration: "1 小時 15 分", stops: 8, price: "NT$ 90" },
    { time: "08:00", arrive: "09:05", code: "9005", duration: "1 小時 5 分", stops: 10, price: "NT$ 110" },
    { time: "09:00", arrive: "10:10", code: "1861", duration: "1 小時 10 分", stops: 8, price: "NT$ 90" },
    { time: "10:00", arrive: "11:05", code: "9005", duration: "1 小時 5 分", stops: 10, price: "NT$ 110" },
  ],
  metro: [
    { time: "06:05", arrive: "06:45", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:15", arrive: "06:55", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:25", arrive: "07:05", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:35", arrive: "07:15", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:45", arrive: "07:25", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
  ],
};

export function ResultsView({ origin, dest, mode }: { origin: string; dest: string; mode: Mode }) {
  const results = RESULTS_BY_MODE[mode];
  const meta = MODE_META[mode];

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tools/transit-dream"
          aria-label="返回首頁"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F3EFFC] text-[#6F5FD6]"
        >
          ←
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#4A3B7C]">
            {origin} <span aria-hidden>→</span> {dest}
          </p>
          <p className="flex items-center gap-1 text-xs text-[#B3ABD4]">
            <IconImg src={meta.icon} alt={meta.label} size={12} /> {meta.label}・共 {results.length} 筆班次・之後會接真的即時資料
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {results.map((r, i) => (
          <div key={i} className="rounded-[1.5rem] bg-white p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.25)]">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                  {r.time} <span aria-hidden>→</span> {r.arrive}
                </p>
                <p className="mt-0.5 text-xs text-[#9C94C4]">{r.duration}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="rounded-full bg-[#F3EFFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#6F5FD6]">{r.price}</span>
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass(mode, r.code)}`}>
                  <IconImg src={meta.icon} alt={meta.label} size={12} /> {r.code}
                  {mode === "bus" ? " 路" : ""}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#F2EEFA] pt-3 text-xs">
              <div>
                <p className="text-[#B3ABD4]">車程時間</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.duration}</p>
              </div>
              <div>
                <p className="text-[#B3ABD4]">停靠站數</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.stops} 站</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
