"use client";

import { useState } from "react";
import { type Mode } from "./stations-data";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";
import { DISTRICTS_BY_CITY } from "@/lib/cwa-districts";

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: "bus", label: "公車", icon: ICON_PATHS.modeBus },
  { key: "train", label: "火車", icon: ICON_PATHS.modeTrain },
  { key: "metro", label: "捷運", icon: ICON_PATHS.modeMetro },
  { key: "thsr", label: "高鐵", icon: ICON_PATHS.modeThsr },
];

export interface HomeDefaults {
  defaultMode: Mode;
  weatherOriginCity: string;
  weatherOriginDistrict: string;
  weatherDestCity: string;
  weatherDestDistrict: string;
}

/** 縣市＋鄉鎮區兩層下拉選單，city/district 其中一個不在清單裡時自動退回清單第一個，
 *  避免存起來的舊資料跟現在的行政區清單對不起來而整個壞掉。 */
function CityDistrictPicker({
  city,
  district,
  onChangeCity,
  onChangeDistrict,
}: {
  city: string;
  district: string;
  onChangeCity: (city: string) => void;
  onChangeDistrict: (district: string) => void;
}) {
  const safeCity = DISTRICTS_BY_CITY[city] ? city : Object.keys(DISTRICTS_BY_CITY)[0];
  const districts = DISTRICTS_BY_CITY[safeCity] ?? [];
  const safeDistrict = districts.includes(district) ? district : districts[0];

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
        <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
        <select
          value={safeCity}
          onChange={(e) => {
            const nextCity = e.target.value;
            onChangeCity(nextCity);
            onChangeDistrict(DISTRICTS_BY_CITY[nextCity][0]);
          }}
          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
        >
          {Object.keys(DISTRICTS_BY_CITY).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
        <select
          value={safeDistrict}
          onChange={(e) => onChangeDistrict(e.target.value)}
          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
        >
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
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
  onClose,
  onSave,
  onPreviewOriginCity,
  onPreviewOriginDistrict,
  onPreviewDestCity,
  onPreviewDestDistrict,
}: {
  open: boolean;
  initial: HomeDefaults;
  onClose: () => void;
  onSave: (defaults: HomeDefaults) => void;
  /** 天氣地區下拉選單一改，就直接套用到首頁的天氣小卡，不用等按「儲存」。 */
  onPreviewOriginCity: (city: string) => void;
  onPreviewOriginDistrict: (district: string) => void;
  onPreviewDestCity: (city: string) => void;
  onPreviewDestDistrict: (district: string) => void;
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

          <div className="border-t border-[#F2EEFA] pt-4">
            <p className="mb-2 text-xs font-medium text-[#9C94C4]">天氣地區（出發）</p>
            <CityDistrictPicker
              city={draft.weatherOriginCity}
              district={draft.weatherOriginDistrict}
              onChangeCity={(c) => {
                setDraft((d) => ({ ...d, weatherOriginCity: c }));
                onPreviewOriginCity(c);
              }}
              onChangeDistrict={(dist) => {
                setDraft((d) => ({ ...d, weatherOriginDistrict: dist }));
                onPreviewOriginDistrict(dist);
              }}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">天氣地區（抵達）</span>
            <CityDistrictPicker
              city={draft.weatherDestCity}
              district={draft.weatherDestDistrict}
              onChangeCity={(c) => {
                setDraft((d) => ({ ...d, weatherDestCity: c }));
                onPreviewDestCity(c);
              }}
              onChangeDistrict={(dist) => {
                setDraft((d) => ({ ...d, weatherDestDistrict: dist }));
                onPreviewDestDistrict(dist);
              }}
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
