"use client";

import { useState } from "react";
import { type Mode } from "./stations-data";
import { DISTRICTS_BY_CITY } from "@/lib/cwa-districts";
import type { WeatherBlock } from "./weather-carousel";

const MODES: { key: Mode; label: string }[] = [
  { key: "bus", label: "公車" },
  { key: "train", label: "火車" },
  { key: "metro", label: "捷運" },
  { key: "thsr", label: "高鐵" },
];

export interface HomeDefaults {
  defaultMode: Mode;
  weatherBlocks: WeatherBlock[];
}

function newWeatherBlock(): WeatherBlock {
  const keys = Object.keys(DISTRICTS_BY_CITY);
  const city = keys[0];
  return { id: crypto.randomUUID(), city, district: DISTRICTS_BY_CITY[city][0] };
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
      </div>
    </div>
  );
}

export function HomeSettingsModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: HomeDefaults;
  onClose: () => void;
  onSave: (defaults: HomeDefaults) => void;
}) {
  const [draft, setDraft] = useState<HomeDefaults>(initial);

  if (!open) return null;

  function updateBlock(index: number, patch: Partial<WeatherBlock>) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.map((block, i) => (i === index ? { ...block, ...patch } : block)) }));
  }

  function removeBlock(index: number) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.filter((_, i) => i !== index) }));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      {/* max-h 用 % 不是 vh：外層卡片容器有 transform，是這個 fixed 彈窗的定位基準，桌面寬度
          時卡片是寫死 850px 高、不是跟著瀏覽器視窗高度變化，vh 會抓到瀏覽器高度而不是卡片
          高度，兩者不一致時彈窗會比卡片本身還高。 */}
      <div
        className="flex max-h-[70%] w-full flex-col overflow-y-auto rounded-t-[1.75rem] bg-white"
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
            </div>
          </label>

          <div className="flex flex-col gap-3 border-t border-[#F2EEFA] pt-4">
            <p className="text-xs font-medium text-[#9C94C4]">
              天氣地區（每個區塊會自動展開成「今天」「明天」兩張首頁輪播卡，可新增多個區塊）
            </p>
            {draft.weatherBlocks.map((block, i) => (
              <div key={block.id} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#9C94C4]">天氣地區 第 {i + 1} 區塊</span>
                  {draft.weatherBlocks.length > 1 && (
                    <button type="button" onClick={() => removeBlock(i)} className="text-xs font-medium text-[#D1517E]">
                      刪除
                    </button>
                  )}
                </div>

                <CityDistrictPicker
                  city={block.city}
                  district={block.district}
                  onChangeCity={(c) => updateBlock(i, { city: c })}
                  onChangeDistrict={(d) => updateBlock(i, { district: d })}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, weatherBlocks: [...d.weatherBlocks, newWeatherBlock()] }))}
              className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
            >
              ＋ 新增區塊
            </button>
          </div>
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
