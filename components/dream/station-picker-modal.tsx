"use client";

import { useState } from "react";
import { FaIcon } from "./fa-icon";
import { BottomSheetModal } from "./bottom-sheet-modal";

/** 城市＋站名雙欄選擇彈窗：取代原生 <select>，手機上不會跳出系統原生的下拉選單，
 *  外殼（置中/置底、標題＋✕、底部取消／確定）共用 BottomSheetModal。 */
export function StationPickerModal({
  open,
  title,
  cities,
  initialCity,
  initialStation,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  cities: Record<string, string[]>;
  initialCity: string;
  initialStation: string;
  onClose: () => void;
  onSave: (city: string, station: string) => void;
}) {
  const cityKeys = Object.keys(cities);
  const [city, setCity] = useState(cities[initialCity] ? initialCity : cityKeys[0]);
  const [station, setStation] = useState(initialStation);

  const stations = cities[city] ?? [];

  function selectCity(c: string) {
    setCity(c);
    // 換城市時，原本選的站名如果不在新城市的清單裡，先頂一個該城市的第一站。
    const list = cities[c] ?? [];
    if (!list.includes(station)) setStation(list[0]);
  }

  return (
    <BottomSheetModal
      open={open}
      title={title}
      onClose={onClose}
      bodyClassName="flex h-[320px]"
      footer={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(city, station)}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            確定
          </button>
        </>
      }
    >
      {/* 只有一個城市／系統可以選時（例如捷運抵達站被鎖定跟出發站同一個系統），這一欄
          沒有意義、直接不顯示，站名清單改成滿版，少一次多餘的點擊。 */}
      {cityKeys.length > 1 && (
        <div className="w-[38%] shrink-0 overflow-y-auto border-r border-[#F2EEFA] py-2">
          {cityKeys.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectCity(c)}
              className={`flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm transition-colors ${
                c === city ? "bg-[#F3EFFC] font-semibold text-[#6F5FD6]" : "text-[#4A3B7C]"
              }`}
            >
              <FaIcon icon="location-dot" size={12} />
              <span className="truncate">{c}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-2">
        {stations.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStation(s)}
            className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
              s === station ? "bg-[#F3EFFC] font-semibold text-[#6F5FD6]" : "text-[#4A3B7C]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </BottomSheetModal>
  );
}
