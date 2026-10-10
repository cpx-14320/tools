"use client";

import { useState } from "react";
import { DISTRICTS_BY_CITY } from "@/lib/transit/cwa-districts";
import { StationPickerModal } from "./station-picker-modal";
import type { WeatherBlock } from "./weather-carousel";

export interface HomeDefaults {
  weatherBlocks: WeatherBlock[];
}

// 跟首頁 home-view.tsx 的 defaultWeatherBlocks() 同一組預設地區（桃園市中壢區、臺北市
// 南港區）——剛註冊、還沒設定過天氣地區的使用者打開這個彈窗時，直接看到這兩個區塊，
// 不要是空的；這個元件自己保底一份，不管呼叫端傳進來的 initial 是不是真的有兩組。
const DEFAULT_WEATHER_BLOCKS: WeatherBlock[] = [
  { id: "default-origin", city: "桃園市", district: "中壢區" },
  { id: "default-dest", city: "臺北市", district: "南港區" },
];

function newWeatherBlock(): WeatherBlock {
  const keys = Object.keys(DISTRICTS_BY_CITY);
  const city = keys[0];
  return { id: crypto.randomUUID(), city, district: DISTRICTS_BY_CITY[city][0] };
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
  const [draft, setDraft] = useState<HomeDefaults>(
    initial.weatherBlocks.length > 0 ? initial : { weatherBlocks: DEFAULT_WEATHER_BLOCKS },
  );
  // 天氣地區改用跟首頁出發站／抵達站同一顆 StationPickerModal（城市＋鄉鎮區雙欄彈窗），
  // 不用瀏覽器原生的 <select>；好幾個區塊共用同一顆彈窗實例，用這個 index 記住現在在editing
  // 哪一個區塊，不用每個區塊各自掛一顆。
  const [blockEditIndex, setBlockEditIndex] = useState<number | null>(null);

  if (!open) return null;

  function updateBlock(index: number, patch: Partial<WeatherBlock>) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.map((block, i) => (i === index ? { ...block, ...patch } : block)) }));
  }

  function removeBlock(index: number) {
    setDraft((d) => ({ ...d, weatherBlocks: d.weatherBlocks.filter((_, i) => i !== index) }));
  }

  const editingBlock = blockEditIndex !== null ? draft.weatherBlocks[blockEditIndex] : null;
  const editingSafeCity = editingBlock && DISTRICTS_BY_CITY[editingBlock.city] ? editingBlock.city : Object.keys(DISTRICTS_BY_CITY)[0];

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
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-[#9C94C4]">
              天氣地區（每個區塊會自動展開成「今天」「明天」兩張首頁輪播卡，可新增多個區塊）
            </p>
            {draft.weatherBlocks.map((block, i) => {
              const safeCity = DISTRICTS_BY_CITY[block.city] ? block.city : Object.keys(DISTRICTS_BY_CITY)[0];
              const districts = DISTRICTS_BY_CITY[safeCity] ?? [];
              const safeDistrict = districts.includes(block.district) ? block.district : districts[0];
              return (
                <div key={block.id} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#9C94C4]">天氣地區 第 {i + 1} 區塊</span>
                    {draft.weatherBlocks.length > 1 && (
                      <button type="button" onClick={() => removeBlock(i)} className="text-xs font-medium text-[#D1517E]">
                        刪除
                      </button>
                    )}
                  </div>

                  <button type="button" onClick={() => setBlockEditIndex(i)} className="grid grid-cols-2 gap-2 text-left">
                    <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                      <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeCity}</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                      <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeDistrict}</span>
                    </div>
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, weatherBlocks: [...d.weatherBlocks, newWeatherBlock()] }))}
              className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
            >
              ＋ 新增區塊
            </button>
          </div>
        </div>

        <StationPickerModal
          key={blockEditIndex !== null ? `block-${blockEditIndex}` : "block-closed"}
          open={blockEditIndex !== null}
          title="選擇天氣地區"
          cities={DISTRICTS_BY_CITY}
          initialCity={editingSafeCity}
          initialStation={editingBlock?.district ?? ""}
          onClose={() => setBlockEditIndex(null)}
          onSave={(city, district) => {
            if (blockEditIndex !== null) updateBlock(blockEditIndex, { city, district });
            setBlockEditIndex(null);
          }}
        />

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
