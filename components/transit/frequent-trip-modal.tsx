"use client";

import { useEffect, useState } from "react";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, destCitiesFor, type Mode } from "./stations-data";
import { ImageSlot } from "./image-slot";
import { TimePickerModal } from "./time-picker-modal";
import { StationPickerModal } from "./station-picker-modal";
import { BusRoutePickerModal, routeBadgeStyle, type BusRouteSelection } from "./bus-route-picker-modal";
import { FREQUENT_TRIP_ICON_OPTIONS } from "./frequent-trip-icons";
import { EditorSheet } from "./editor-sheet";
import {
  AddButton,
  Badge,
  DragHandle,
  EditorItemCard,
  EditorItemHeader,
  ErrorText,
  Field,
  FieldRow,
  IconButton,
  SelectButton,
  TextInput,
} from "./ui";
import { copy, text } from "./theme";
import { fetchTrainStationCities } from "@/lib/transit/train-cities-client";
import { moveItem, useDragReorder } from "./use-drag-reorder";

export interface FrequentTripDraft {
  id?: string;
  icon: string;
  // 公車是「路線優先」（見 bus-route-picker-modal.tsx 的 BusRouteSelection），不是起訖站：
  // originCity 存縣市、origin 存路線名稱、dest 存站牌名稱、destCity 不使用；busDirection
  // （0＝去程、1＝返程）只有公車會用到。
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  busDirection?: 0 | 1;
  startTime: string;
  endTime: string;
}

function blankDraft(mode: Mode, cities: Record<string, string[]>): FrequentTripDraft {
  // 公車還沒選過路線／站牌時留空，讓按鈕顯示「選擇路線」「選擇站牌」佔位文字。
  if (mode === "bus") {
    return { icon: FREQUENT_TRIP_ICON_OPTIONS[0].key, originCity: "", origin: "", destCity: "", dest: "", startTime: "08:00", endTime: "09:00" };
  }
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
// API 換成真的站名清單（經過 fetchTrainStationCities 這層共用快取，整個分頁只會真的請求
// 一次，不會每打開一次彈窗就重打）；公車／高鐵／捷運三種車種彼此的站點資料來源跟選擇
// 邏輯完全不同（公車／高鐵是固定縣市清單、捷運是固定的捷運系統清單），各自獨立成下面
// 三個函式，不共用一套「假設全部車種都一樣」的通用邏輯——之後要單獨幫某個車種換資料
// 來源或加欄位時，不會牽動到其他車種。
function useTrainCities(active: boolean): Record<string, string[]> {
  const [cities, setCities] = useState<Record<string, string[]>>(FALLBACK_TRAIN_STATIONS_BY_CITY);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchTrainStationCities()
      .then(({ byCity }) => {
        if (cancelled || Object.keys(byCity).length === 0) return;
        setCities(byCity);
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
  /** 分類名稱完全由使用者自訂（例如「上班」「下班」「假日出去玩」），不是寫死的選項；
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
  // 同一套邏輯；跟首頁出發／抵達站用的是同一份 STATIONS_BY_CITY／destCitiesFor，不同
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
  // 公車是「路線優先」搜尋（見 bus-route-picker-modal.tsx），不是出發／抵達站；
  // 一樣用「正在編輯第幾則」記住現在開著的是哪一則的公車選擇器，不用每一則各自掛一顆。
  const [busEditTarget, setBusEditTarget] = useState<number | null>(null);
  // 行程在分類底下的顯示順序就是這份清單的順序（存檔時 order 照索引寫回，見
  // lib/transit/frequent-trips.ts），拖曳只要改這個陣列、按儲存就生效。
  const drag = useDragReorder(
    items.length,
    (from, to) => setItems((list) => moveItem(list, from, to)),
    () => {},
  );

  // 火車的真實站名清單是非同步載入的：如果編輯清單目前還是「只有一筆、還沒存過（沒有
  // id）」的初始空白墊檔，等真實清單載入後重新產生一次，不然使用者還沒手動選過站的話
  // 存檔時可能還是墊檔站名；已經存在資料庫的既有筆數（有 id）不受影響，不會被覆蓋。
  useEffect(() => {
    if (mode !== "train") return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setItems((list) => (list.length === 1 && !list[0].id ? [blankDraft(mode, trainCities)] : list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainCities]);

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

  function save() {
    const trimmed = name.trim() || `未命名${copy.group}`;
    if (isNameTaken?.(trimmed)) {
      setNameError(true);
      return;
    }
    onSave(trimmed, items);
  }

  return (
    <EditorSheet
      open={open}
      title={initialName ? `編輯${copy.group}` : `新增${copy.group}`}
      onClose={onClose}
      onSave={save}
      onDelete={onDelete}
      deleteLabel={`${copy.delete}${copy.group}`}
    >
      <Field label={`${copy.group}名稱`}>
        <TextInput
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameError(false);
          }}
          placeholder="例如：上班、下班、出去玩"
          className={nameError ? "border-[#D1517E]" : ""}
        />
        {nameError && <ErrorText>這個車種已經有同名的{copy.group}了</ErrorText>}
      </Field>

      {items.map((item, i) => {
        const safeOriginCity = cities[item.originCity] ? item.originCity : Object.keys(cities)[0];
        return (
          <div key={i} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
            <EditorItemCard>
              <EditorItemHeader
                index={i}
                unit="則"
                onDelete={items.length > 1 ? () => removeItem(i) : undefined}
                dragHandle={<DragHandle label={`拖曳排序 第 ${i + 1} 則${copy.tripItem}`} {...drag.handleProps(i)} />}
              />

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

              {mode === "bus" ? (
                <Field as="div" label="路線／站牌">
                  <FieldRow>
                    <SelectButton chevron={false} onClick={() => setBusEditTarget(i)}>
                      {item.origin ? (
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                          <Badge className={routeBadgeStyle(item.origin)}>{item.origin}</Badge>
                          <span className={`truncate ${text.meta}`}>{item.busDirection === 1 ? "返程" : "去程"}</span>
                        </span>
                      ) : (
                        <span className={`flex-1 truncate ${text.placeholder}`}>選擇路線</span>
                      )}
                    </SelectButton>
                    <SelectButton value={item.dest} placeholder="選擇站牌" onClick={() => setBusEditTarget(i)} />
                  </FieldRow>
                </Field>
              ) : (
                <div className="relative flex flex-col gap-3">
                  <Field as="div" label={`出發${stationLabel}`}>
                    <FieldRow>
                      <SelectButton chevron={false} value={safeOriginCity} onClick={() => setStationEditTarget({ index: i, field: "origin" })} />
                      <SelectButton value={item.origin} onClick={() => setStationEditTarget({ index: i, field: "origin" })} />
                    </FieldRow>
                  </Field>

                  <IconButton
                    icon="right-left"
                    tone="white"
                    size={32}
                    iconSize={12}
                    aria-label="交換出發站與抵達站"
                    onClick={() =>
                      updateItem(i, { originCity: item.destCity, origin: item.dest, destCity: item.originCity, dest: item.origin })
                    }
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 border-[#ECE4FA] bg-white"
                  />

                  <Field as="div" label={`抵達${stationLabel}`}>
                    <FieldRow>
                      <SelectButton chevron={false} value={item.destCity} onClick={() => setStationEditTarget({ index: i, field: "dest" })} />
                      <SelectButton value={item.dest} onClick={() => setStationEditTarget({ index: i, field: "dest" })} />
                    </FieldRow>
                  </Field>
                </div>
              )}

              <Field as="div" label="時段區間">
                <FieldRow>
                  <SelectButton chevron={false} value={item.startTime} onClick={() => setTimeEditTarget({ index: i, field: "startTime" })} />
                  <SelectButton chevron={false} value={item.endTime} onClick={() => setTimeEditTarget({ index: i, field: "endTime" })} />
                </FieldRow>
              </Field>
            </EditorItemCard>
          </div>
        );
      })}

      <AddButton onClick={() => setItems((list) => [...list, blankDraft(mode, cities)])}>新增{copy.tripItem}</AddButton>

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

      <BusRoutePickerModal
        key={busEditTarget !== null ? `bus-${busEditTarget}` : "bus-closed"}
        open={busEditTarget !== null}
        initial={
          busEditTarget !== null
            ? {
                cityName: items[busEditTarget].originCity,
                routeName: items[busEditTarget].origin,
                direction: items[busEditTarget].busDirection ?? 0,
                stopName: items[busEditTarget].dest,
              }
            : undefined
        }
        onClose={() => setBusEditTarget(null)}
        onSave={(selection: BusRouteSelection) => {
          if (busEditTarget !== null) {
            updateItem(busEditTarget, {
              originCity: selection.cityName,
              origin: selection.routeName,
              destCity: "",
              dest: selection.stopName,
              busDirection: selection.direction,
            });
          }
          setBusEditTarget(null);
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
    </EditorSheet>
  );
}
