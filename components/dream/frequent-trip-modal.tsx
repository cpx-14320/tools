"use client";

import { useEffect, useState } from "react";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, destCitiesFor, type Mode } from "./stations-data";
import { ImageSlot } from "./image-slot";
import { TimePickerModal } from "./time-picker-modal";
import { StationPickerModal } from "./station-picker-modal";
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

function blankDraft(mode: Mode, cities: Record<string, string[]>): FrequentTripDraft {
  const keys = Object.keys(cities);
  const originCity = keys[0];
  // 捷運預設出發／抵達站先給同一個系統：不同系統大多沒有互通，用 keys[1] 當預設抵達站
  // 系統的話，一開始就會出現一組選不出合理路線的組合。
  const destCity = mode === "metro" ? originCity : keys[1] ?? keys[0];
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
// （公車／高鐵是固定縣市清單、捷運是固定的捷運系統清單），各自獨立成下面三個函式，不共用一套
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
  // 同一套邏輯；跟首頁出發站／抵達站用的是同一份 STATIONS_BY_CITY／destCitiesFor，不同
  // 車種可選的清單才會跟首頁完全一致。
  const cities = mode === "train" ? trainCities : mode === "bus" ? busCities() : mode === "thsr" ? thsrCities() : metroCities();

  // 父層針對每個分類（或新增）都用不同的 key 掛載這個元件，切換分類／開新增時會整個
  // 重新 mount，name／items 的初始值自然就是當下傳入的那一份，不用額外用 effect 同步。
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState(false);
  const [items, setItems] = useState<FrequentTripDraft[]>(initial.length > 0 ? initial : [blankDraft(mode, cities)]);
  // 時段區間的開始／結束時間改用跟首頁同一顆 TimePickerModal，不用瀏覽器原生的時間選擇器；
  // 每一則都有自己的開始／結束兩個時間欄位，共用一顆彈窗、記住「現在在編哪一則的哪個欄位」
  // 就好，不用每一則各自掛一顆彈窗實例。
  const [timeEditTarget, setTimeEditTarget] = useState<{ index: number; field: "startTime" | "endTime" } | null>(null);
  // 出發／抵達站改用跟首頁同一顆 StationPickerModal（城市＋站名雙欄選擇），不用瀏覽器
  // 原生的 <select>；同一套 {index, field} 做法記住現在在編哪一則的出發還是抵達站。
  const [stationEditTarget, setStationEditTarget] = useState<{ index: number; field: "origin" | "dest" } | null>(null);

  // 火車的真實站名清單是非同步載入的：如果編輯清單目前還是「只有一筆、還沒存過（沒有
  // id）」的初始空白墊檔，等真實清單載入後重新產生一次，不然使用者還沒手動選過站的話
  // 存檔時可能還是墊檔站名；已經存在資料庫的既有筆數（有 id）不受影響，不會被覆蓋。
  useEffect(() => {
    if (mode !== "train") return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setItems((list) => (list.length === 1 && !list[0].id ? [blankDraft(mode, trainCities)] : list));
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

  // 換了出發站的系統，原本選的抵達站如果在新的出發系統底下已經不能選（不同系統又沒有
  // 互通），抵達站要跟著重設，不然會卡著一組已經不合法的出發／抵達組合——跟首頁
  // StationPickerModal 的 onSave 同一套邏輯。
  function selectOrigin(index: number, city: string, station: string) {
    const nextDestCities = destCitiesFor(mode, city, cities);
    if (nextDestCities[items[index].destCity]) {
      updateItem(index, { originCity: city, origin: station });
    } else {
      const firstDestCity = Object.keys(nextDestCities)[0];
      updateItem(index, { originCity: city, origin: station, destCity: firstDestCity, dest: nextDestCities[firstDestCity][0] });
    }
  }

  function selectDest(index: number, city: string, station: string) {
    updateItem(index, { destCity: city, dest: station });
  }

  const stationEditing = stationEditTarget ? items[stationEditTarget.index] : null;
  const stationEditingSafeOriginCity = stationEditing && cities[stationEditing.originCity] ? stationEditing.originCity : Object.keys(cities)[0];
  const stationEditingDestCities = stationEditing ? destCitiesFor(mode, stationEditingSafeOriginCity, cities) : {};

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
              placeholder="例如：上班、下班、出去玩"
              className={`rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6] ${
                nameError ? "border-[#D1517E]" : "border-[#ECE4FA]"
              }`}
            />
            {nameError && <span className="text-xs text-[#D1517E]">這個車種已經有同名的分類了</span>}
          </label>

          {items.map((item, i) => {
            const safeOriginCity = cities[item.originCity] ? item.originCity : Object.keys(cities)[0];
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
                      className={item.icon === option.key ? "" : "opacity-50"}
                    >
                      <ImageSlot src={option.icon} alt={option.key} className="size-9 rounded-lg" />
                    </button>
                  ))}
                </div>

                <div className="relative flex flex-col gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-[#9C94C4]">出發{stationLabel}</span>
                    <button
                      type="button"
                      onClick={() => setStationEditTarget({ index: i, field: "origin" })}
                      className="grid grid-cols-2 gap-2 text-left"
                    >
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                        <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeOriginCity}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                        <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{item.origin}</span>
                      </div>
                    </button>
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
                    <button
                      type="button"
                      onClick={() => setStationEditTarget({ index: i, field: "dest" })}
                      className="grid grid-cols-2 gap-2 text-left"
                    >
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                        <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{item.destCity}</span>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                        <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{item.dest}</span>
                      </div>
                    </button>
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-[#9C94C4]">時段區間</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTimeEditTarget({ index: i, field: "startTime" })}
                      className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3 text-left"
                    >
                      <span className="flex-1 text-sm font-medium text-[#4A3B7C]">{item.startTime}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeEditTarget({ index: i, field: "endTime" })}
                      className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3 text-left"
                    >
                      <span className="flex-1 text-sm font-medium text-[#4A3B7C]">{item.endTime}</span>
                    </button>
                  </div>
                </label>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setItems((list) => [...list, blankDraft(mode, cities)])}
            className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
          >
            ＋ 新增一則
          </button>
        </div>

        <TimePickerModal
          key={timeEditTarget ? `time-${timeEditTarget.index}-${timeEditTarget.field}` : "time-closed"}
          open={timeEditTarget !== null}
          initial={timeEditTarget ? items[timeEditTarget.index][timeEditTarget.field] : "08:00"}
          onClose={() => setTimeEditTarget(null)}
          onSave={(v) => {
            if (timeEditTarget) updateItem(timeEditTarget.index, { [timeEditTarget.field]: v });
            setTimeEditTarget(null);
          }}
        />

        <StationPickerModal
          key={stationEditTarget ? `station-${stationEditTarget.index}-${stationEditTarget.field}` : "station-closed"}
          open={stationEditTarget !== null}
          title={stationEditTarget?.field === "dest" ? `選擇抵達${stationLabel}` : `選擇出發${stationLabel}`}
          cities={stationEditTarget?.field === "dest" ? stationEditingDestCities : cities}
          initialCity={stationEditTarget?.field === "dest" ? (stationEditing?.destCity ?? "") : stationEditingSafeOriginCity}
          initialStation={stationEditTarget?.field === "dest" ? (stationEditing?.dest ?? "") : (stationEditing?.origin ?? "")}
          onClose={() => setStationEditTarget(null)}
          onSave={(city, station) => {
            if (stationEditTarget) {
              if (stationEditTarget.field === "origin") selectOrigin(stationEditTarget.index, city, station);
              else selectDest(stationEditTarget.index, city, station);
            }
            setStationEditTarget(null);
          }}
        />

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
