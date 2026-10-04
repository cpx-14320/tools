"use client";

import { useEffect, useState } from "react";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, type Mode } from "./stations-data";
import { IconImg } from "./icon-img";
import { ImageSlot } from "./image-slot";
import { ICON_PATHS } from "./icon-paths";
import { FREQUENT_TRIP_ICON_OPTIONS } from "./frequent-trip-icons";

export interface FrequentTripDraft {
  id?: string;
  icon: string;
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  startTime: string;
  endTime: string;
}

function blankDraft(cities: Record<string, string[]>): FrequentTripDraft {
  const keys = Object.keys(cities);
  const originCity = keys[0];
  const destCity = keys[1] ?? keys[0];
  return {
    icon: FREQUENT_TRIP_ICON_OPTIONS[0].key,
    originCity,
    origin: cities[originCity][0],
    destCity,
    dest: cities[destCity][destCity === originCity && cities[destCity].length > 1 ? 1 : 0],
    startTime: "08:00",
    endTime: "09:00",
  };
}

// 火車目前全台約 240 站，沒辦法像公車／高鐵／捷運一樣用寫死的清單，掛載時才打 TDX 站名
// API 換成真的站名清單；公車／高鐵／捷運三種車種彼此的站點資料來源跟選擇邏輯完全不同
// （公車／高鐵是固定縣市清單、捷運是路線＋站點），各自獨立成下面三個函式，不共用一套
// 「假設全部車種都一樣」的通用邏輯——之後要單獨幫某個車種換資料來源或加欄位時，不會
// 牽動到其他車種。
function useTrainCities(active: boolean): Record<string, string[]> {
  const [cities, setCities] = useState<Record<string, string[]>>(FALLBACK_TRAIN_STATIONS_BY_CITY);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetch("/api/transit/tra/stations")
      .then((res) => res.json())
      .then((data: { cities?: { city: string; stations: { name: string }[] }[] }) => {
        if (cancelled || !data.cities?.length) return;
        const map: Record<string, string[]> = {};
        for (const c of data.cities) map[c.city] = c.stations.map((s) => s.name);
        setCities(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);

  return cities;
}

function busCities(): Record<string, string[]> {
  return STATIONS_BY_CITY.bus;
}

function thsrCities(): Record<string, string[]> {
  return STATIONS_BY_CITY.thsr;
}

function metroCities(): Record<string, string[]> {
  return STATIONS_BY_CITY.metro;
}

const STATION_LABEL: Record<Mode, string> = {
  bus: "站牌",
  train: "站",
  thsr: "站",
  metro: "站",
};

export function FrequentTripModal({
  open,
  mode,
  initialName,
  initial,
  onClose,
  onSave,
  onDelete,
  isNameTaken,
}: {
  open: boolean;
  mode: Mode;
  /** 分類名稱完全由使用者自訂（例如「啟程」「返程」「假日出去玩」），不是寫死的選項；
   *  空字串代表這是一個還沒存過的新分類。 */
  initialName: string;
  initial: FrequentTripDraft[];
  onClose: () => void;
  onSave: (name: string, items: FrequentTripDraft[]) => void;
  /** 只有編輯既有分類時才給這個 callback，新增分類時不顯示刪除按鈕。 */
  onDelete?: () => void;
  /** 同一車種下是否已經有別的分類用這個名字了——有的話擋下儲存、顯示錯誤文字，不呼叫
   *  onSave。父層才知道「同車種其他分類」有哪些，所以這個判斷交給父層做，這裡只負責問。 */
  isNameTaken?: (name: string) => boolean;
}) {
  const trainCities = useTrainCities(mode === "train");
  // 每種車種的站點資料各自獨立來源，這裡只是依目前是哪個 tab 挑一份要用，不是把它們混成
  // 同一套邏輯。
  const cities = mode === "train" ? trainCities : mode === "bus" ? busCities() : mode === "thsr" ? thsrCities() : metroCities();

  // 父層針對每個分類（或新增）都用不同的 key 掛載這個元件，切換分類／開新增時會整個
  // 重新 mount，name／items 的初始值自然就是當下傳入的那一份，不用額外用 effect 同步。
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState(false);
  const [items, setItems] = useState<FrequentTripDraft[]>(initial.length > 0 ? initial : [blankDraft(cities)]);

  // 火車的真實站名清單是非同步載入的：如果編輯清單目前還是「只有一筆、還沒存過（沒有
  // id）」的初始空白墊檔，等真實清單載入後重新產生一次，不然使用者還沒手動選過站的話
  // 存檔時可能還是墊檔站名；已經存在資料庫的既有筆數（有 id）不受影響，不會被覆蓋。
  useEffect(() => {
    if (mode !== "train") return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setItems((list) => (list.length === 1 && !list[0].id ? [blankDraft(trainCities)] : list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainCities]);

  if (!open) return null;

  const stationLabel = STATION_LABEL[mode];

  function updateItem(index: number, patch: Partial<FrequentTripDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function selectOriginCity(index: number, city: string) {
    updateItem(index, { originCity: city, origin: cities[city][0] });
  }

  function selectDestCity(index: number, city: string) {
    updateItem(index, { destCity: city, dest: cities[city][0] });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-y-auto rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">{initialName ? "編輯分類" : "新增分類"}</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">分類名稱</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
              placeholder="例如：啟程、返程、假日出去玩"
              className={`rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6] ${
                nameError ? "border-[#D1517E]" : "border-[#ECE4FA]"
              }`}
            />
            {nameError && <span className="text-xs text-[#D1517E]">這個車種已經有同名的分類了</span>}
          </label>

          {items.map((item, i) => {
            const safeOriginCity = cities[item.originCity] ? item.originCity : Object.keys(cities)[0];
            const safeDestCity = cities[item.destCity] ? item.destCity : Object.keys(cities)[0];
            return (
              <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#9C94C4]">第 {i + 1} 則</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-xs font-medium text-[#D1517E]">
                      刪除
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {FREQUENT_TRIP_ICON_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => updateItem(i, { icon: option.key })}
                      aria-label={`選擇圖示 ${option.key}`}
                      className={`rounded-xl p-0.5 ${item.icon === option.key ? "ring-2 ring-[#6F5FD6]" : ""}`}
                    >
                      <ImageSlot src={option.icon} alt={option.key} className="size-9 rounded-lg" />
                    </button>
                  ))}
                </div>

                <div className="relative flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[#9C94C4]">出發{stationLabel}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                        <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                        <select
                          value={safeOriginCity}
                          onChange={(e) => selectOriginCity(i, e.target.value)}
                          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                        >
                          {Object.keys(cities).map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                        <select
                          value={item.origin}
                          onChange={(e) => updateItem(i, { origin: e.target.value })}
                          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                        >
                          {cities[safeOriginCity].map((s) => (
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
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      updateItem(i, { originCity: item.destCity, origin: item.dest, destCity: item.originCity, dest: item.origin })
                    }
                    aria-label="交換出發站與抵達站"
                    className="absolute right-3 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-[#ECE4FA] bg-white text-[#6F5FD6] shadow-[0_4px_12px_-4px_rgba(111,95,214,0.4)]"
                  >
                    ⇄
                  </button>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[#9C94C4]">抵達{stationLabel}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                        <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                        <select
                          value={safeDestCity}
                          onChange={(e) => selectDestCity(i, e.target.value)}
                          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                        >
                          {Object.keys(cities).map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                        <select
                          value={item.dest}
                          onChange={(e) => updateItem(i, { dest: e.target.value })}
                          className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                        >
                          {cities[safeDestCity].map((s) => (
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
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[#9C94C4]">時段區間</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
                      <IconImg src={ICON_PATHS.clock} alt="開始時間" size={14} />
                      <input
                        type="time"
                        value={item.startTime}
                        onChange={(e) => updateItem(i, { startTime: e.target.value })}
                        className="flex-1 bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
                      <IconImg src={ICON_PATHS.clock} alt="結束時間" size={14} />
                      <input
                        type="time"
                        value={item.endTime}
                        onChange={(e) => updateItem(i, { endTime: e.target.value })}
                        className="flex-1 bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                      />
                    </div>
                  </div>
                </label>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setItems((list) => [...list, blankDraft(cities)])}
            className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
          >
            ＋ 新增一則
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#ECE4FA] px-5 py-4">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="text-sm font-medium text-[#D1517E]">
              刪除此分類
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = name.trim() || "未命名分類";
                if (isNameTaken?.(trimmed)) {
                  setNameError(true);
                  return;
                }
                onSave(trimmed, items);
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
              style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
