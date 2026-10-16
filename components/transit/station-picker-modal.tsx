"use client";

import { useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { GhostButton, PrimaryButton } from "./ui";
import { copy } from "./theme";

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
          <GhostButton onClick={onClose}>{copy.cancel}</GhostButton>
          {/* 選擇器用「確定」、編輯器用「儲存」，見 theme.ts 的 copy 用詞表。 */}
          <PrimaryButton onClick={() => onSave(city, station)}>{copy.confirm}</PrimaryButton>
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
              className={`block w-full truncate px-4 py-2.5 text-left text-sm transition-colors ${
                c === city ? "bg-[#F3EFFC] font-semibold text-[#6F5FD6]" : "text-[#4A3B7C]"
              }`}
            >
              {c}
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
