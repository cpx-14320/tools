"use client";

import { useState } from "react";
import { type Mode } from "./stations-data";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: "bus", label: "公車", icon: ICON_PATHS.modeBus },
  { key: "train", label: "火車", icon: ICON_PATHS.modeTrain },
  { key: "metro", label: "捷運", icon: ICON_PATHS.modeMetro },
  { key: "thsr", label: "高鐵", icon: ICON_PATHS.modeThsr },
];

export interface HomeDefaults {
  defaultMode: Mode;
  defaultTime: string;
  weatherOriginCity: string;
  weatherOriginStation: string;
  weatherDestCity: string;
  weatherDestStation: string;
}

/** 城市＋站點兩層下拉選單，city/station 其中一個不在目前清單裡時自動退回清單第一個，
 *  避免天氣縣市清單還沒載入完成時 options 對不起來而整個壞掉。 */
function CityStationPicker({
  cities,
  city,
  station,
  onChangeCity,
  onChangeStation,
}: {
  cities: Record<string, string[]>;
  city: string;
  station: string;
  onChangeCity: (city: string) => void;
  onChangeStation: (station: string) => void;
}) {
  const safeCity = cities[city] ? city : Object.keys(cities)[0];
  const stations = cities[safeCity] ?? [];
  const safeStation = stations.includes(station) ? station : stations[0];

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
        <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
        <select
          value={safeCity}
          onChange={(e) => {
            const nextCity = e.target.value;
            onChangeCity(nextCity);
            onChangeStation(cities[nextCity][0]);
          }}
          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
        >
          {Object.keys(cities).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
        <select
          value={safeStation}
          onChange={(e) => onChangeStation(e.target.value)}
          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
        >
          {stations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none text-[#C7BFE6]">
          ⌄
        </span>
      </div>
    </div>
  );
}

export function HomeSettingsModal({
  open,
  initial,
  trainCities,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: HomeDefaults;
  trainCities: Record<string, string[]>;
  onClose: () => void;
  onSave: (defaults: HomeDefaults) => void;
}) {
  const [draft, setDraft] = useState<HomeDefaults>(initial);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-y-auto rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">編輯首頁預設值</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">預設運輸工具</span>
            <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
              <IconImg src={MODES.find((m) => m.key === draft.defaultMode)?.icon ?? ICON_PATHS.modeTrain} alt="運輸工具" size={18} />
              <select
                value={draft.defaultMode}
                onChange={(e) => setDraft((d) => ({ ...d, defaultMode: e.target.value as Mode }))}
                className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
              >
                {MODES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span aria-hidden className="pointer-events-none text-[#C7BFE6]">
                ⌄
              </span>
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">預設時間</span>
            <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
              <IconImg src={ICON_PATHS.clock} alt="時間" size={14} />
              <input
                type="time"
                value={draft.defaultTime}
                onChange={(e) => e.target.value && setDraft((d) => ({ ...d, defaultTime: e.target.value }))}
                className="flex-1 bg-transparent text-sm font-medium text-[#4A3B7C] outline-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          </label>

          <div className="border-t border-[#F2EEFA] pt-4">
            <p className="mb-2 text-xs font-medium text-[#9C94C4]">天氣地區（出發）</p>
            <CityStationPicker
              cities={trainCities}
              city={draft.weatherOriginCity}
              station={draft.weatherOriginStation}
              onChangeCity={(c) => setDraft((d) => ({ ...d, weatherOriginCity: c }))}
              onChangeStation={(s) => setDraft((d) => ({ ...d, weatherOriginStation: s }))}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">天氣地區（抵達）</span>
            <CityStationPicker
              cities={trainCities}
              city={draft.weatherDestCity}
              station={draft.weatherDestStation}
              onChangeCity={(c) => setDraft((d) => ({ ...d, weatherDestCity: c }))}
              onChangeStation={(s) => setDraft((d) => ({ ...d, weatherDestStation: s }))}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
