"use client";

import { useEffect, useState } from "react";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, type Mode } from "./stations-data";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const MODES = [
  { key: "train" as Mode, label: "火車", icon: ICON_PATHS.modeTrain },
  { key: "thsr" as Mode, label: "高鐵", icon: ICON_PATHS.modeThsr },
  { key: "bus" as Mode, label: "公車", icon: ICON_PATHS.modeBus },
  { key: "metro" as Mode, label: "捷運", icon: ICON_PATHS.modeMetro },
];

function resolveStation(mode: Mode, preferred: string | undefined, fallbackIndex: number) {
  const cities = Object.keys(STATIONS_BY_CITY[mode]);
  if (preferred) {
    const found = cities.find((city) => STATIONS_BY_CITY[mode][city].includes(preferred));
    if (found) return { city: found, station: preferred };
  }
  const city = cities[Math.min(fallbackIndex, cities.length - 1)];
  return { city, station: STATIONS_BY_CITY[mode][city][0] };
}

export interface RouteDraft {
  mode?: string;
  origin: string;
  dest: string;
  favorited: boolean;
}

export function RouteModal({
  open,
  initial,
  lockedMode,
  title,
  onClose,
}: {
  open: boolean;
  initial?: RouteDraft;
  lockedMode?: Mode;
  title?: string;
  onClose: () => void;
}) {
  const initialMode: Mode = lockedMode ?? (initial?.mode as Mode) ?? "train";
  const originInit = resolveStation(initialMode, initial?.origin, 0);
  const destInit = resolveStation(initialMode, initial?.dest, 1);

  const [mode, setMode] = useState<Mode>(initialMode);
  // 火車先用靜態清單墊著畫面，掛載後換成 /api/transit/tra/stations 抓回來的真實 ~240 站清單
  // （跟首頁同一套做法），不然像南港這種沒收錄在靜態清單裡的站就選不到。
  const [trainCities, setTrainCities] = useState<Record<string, string[]>>(FALLBACK_TRAIN_STATIONS_BY_CITY);
  const [originCity, setOriginCity] = useState(originInit.city);
  const [origin, setOrigin] = useState(originInit.station);
  const [destCity, setDestCity] = useState(destInit.city);
  const [dest, setDest] = useState(destInit.station);
  const [time, setTime] = useState("08:00");
  const [trainType, setTrainType] = useState("all");
  const [favorited, setFavorited] = useState(initial?.favorited ?? true);
  const stationLabel = mode === "bus" ? "站牌" : "站";
  const citiesForMode = mode === "train" ? trainCities : STATIONS_BY_CITY[mode];
  // 真實清單載入後 key 可能跟墊檔不一樣（例如縣市字一致才不會發生，但保險起見還是擋一下），
  // 避免目前選到的縣市在新清單裡找不到時直接 undefined.map 當掉。
  const safeOriginCity = citiesForMode[originCity] ? originCity : Object.keys(citiesForMode)[0];
  const safeDestCity = citiesForMode[destCity] ? destCity : Object.keys(citiesForMode)[0];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/tra/stations")
      .then((res) => res.json())
      .then((data: { cities?: { city: string; stations: { name: string }[] }[] }) => {
        if (cancelled || !data.cities?.length) return;
        const map: Record<string, string[]> = {};
        for (const c of data.cities) map[c.city] = c.stations.map((s) => s.name);
        setTrainCities(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open) return null;

  function selectMode(key: Mode) {
    setMode(key);
    const cities = key === "train" ? trainCities : STATIONS_BY_CITY[key];
    const keys = Object.keys(cities);
    const oCity = keys[0];
    const dCity = keys[1] ?? keys[0];
    setOriginCity(oCity);
    setOrigin(cities[oCity][0]);
    setDestCity(dCity);
    setDest(cities[dCity][dCity === oCity && cities[dCity].length > 1 ? 1 : 0]);
  }

  function selectOriginCity(city: string) {
    setOriginCity(city);
    setOrigin(citiesForMode[city][0]);
  }

  function selectDestCity(city: string) {
    setDestCity(city);
    setDest(citiesForMode[city][0]);
  }

  const activeModeMeta = MODES.find((m) => m.key === mode);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="flex w-full max-w-[400px] flex-col rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">{title ?? (initial ? "編輯常用路線" : "新增常用路線")}</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <p className="mb-2 text-xs font-medium text-[#9C94C4]">運輸工具</p>
            {lockedMode ? (
              <div className="flex items-center gap-2 rounded-2xl bg-[#EFEAFC] px-4 py-2.5 text-sm font-semibold text-[#6F5FD6]">
                {activeModeMeta && <IconImg src={activeModeMeta.icon} alt={activeModeMeta.label} size={20} />}
                {activeModeMeta?.label}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {MODES.map((m) => {
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => selectMode(m.key)}
                      className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-xs transition-colors ${
                        active ? "border-[#D9CFF5] bg-[#EFEAFC] font-semibold text-[#6F5FD6]" : "border-[#ECE4FA] text-[#9C94C4]"
                      }`}
                    >
                      <IconImg src={m.icon} alt={m.label} size={20} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {mode === "train" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">車種</span>
              <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
                <select
                  value={trainType}
                  onChange={(e) => setTrainType(e.target.value)}
                  className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                >
                  <option value="all">不限車種</option>
                  <option value="自強">自強</option>
                  <option value="莒光">莒光</option>
                  <option value="區間">區間</option>
                </select>
                <span aria-hidden className="pointer-events-none text-[#C7BFE6]">
                  ⌄
                </span>
              </div>
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">出發{stationLabel}</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                <select
                  value={safeOriginCity}
                  onChange={(e) => selectOriginCity(e.target.value)}
                  className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                >
                  {Object.keys(citiesForMode).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                >
                  {citiesForMode[safeOriginCity].map((s) => (
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">抵達{stationLabel}</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                <select
                  value={safeDestCity}
                  onChange={(e) => selectDestCity(e.target.value)}
                  className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                >
                  {Object.keys(citiesForMode).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] px-3 py-3">
                <select
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  className="flex-1 appearance-none bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
                >
                  {citiesForMode[safeDestCity].map((s) => (
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">時間</span>
            <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] px-4 py-3">
              <IconImg src={ICON_PATHS.clock} alt="時間" size={14} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium text-[#4A3B7C] outline-none"
              />
            </div>
          </label>

          {/* 常用路線（我的最愛頁）才需要收藏開關；行程（lockedMode，我的行程頁）不需要。 */}
          {!lockedMode && (
            <button
              type="button"
              onClick={() => setFavorited((f) => !f)}
              className="flex items-center justify-between rounded-2xl border border-[#ECE4FA] px-4 py-3 text-sm text-[#4A3B7C]"
            >
              <span>加入我的最愛</span>
              <IconImg
                src={favorited ? ICON_PATHS.heartFilled : ICON_PATHS.heartOutline}
                alt={favorited ? "已收藏" : "未收藏"}
                size={16}
              />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={onClose}
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
