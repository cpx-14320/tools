"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, type Mode } from "@/components/dream/stations-data";
import { usePageAction } from "@/components/dream/page-action-context";
import { HomeSettingsModal, type HomeDefaults } from "@/components/dream/home-settings-modal";
import { TimePickerModal } from "@/components/dream/time-picker-modal";

const DEFAULTS_KEY = "cpx-tools:transit-dream:home-defaults";

function loadDefaults(): HomeDefaults | null {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? (JSON.parse(raw) as HomeDefaults) : null;
  } catch {
    return null;
  }
}

function saveDefaults(defaults: HomeDefaults) {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // 私密瀏覽模式等情況下 localStorage 可能不可用，失敗就當作這次沒存，不影響當下操作。
  }
}

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: "bus", label: "公車", icon: ICON_PATHS.modeBus },
  { key: "train", label: "火車", icon: ICON_PATHS.modeTrain },
  { key: "metro", label: "捷運", icon: ICON_PATHS.modeMetro },
  { key: "thsr", label: "高鐵", icon: ICON_PATHS.modeThsr },
];

const QUICK_ACTIONS: { label: string; icon: string }[] = [
  { label: "常用路線", icon: ICON_PATHS.quickRoutes },
  { label: "我的最愛", icon: ICON_PATHS.quickFavorites },
  { label: "時刻查詢", icon: ICON_PATHS.quickTimetable },
  { label: "票價查詢", icon: ICON_PATHS.quickFare },
];

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 不能用 toISOString().slice(0,10)：那個是 UTC 日期，台灣是 UTC+8，半夜 0 點到早上 8 點之間
// UTC 還停在前一天，會讓「今天」的日期錯誤地往前跳一天。要跟 nowHHMM() 一樣用本地時間欄位組。
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEATHER_ICONS = [ICON_PATHS.weatherSunny, ICON_PATHS.weatherCloudy, ICON_PATHS.weatherRain];
const WEATHER_LABELS = ["晴天", "多雲", "小雨"];
const WEATHER_ICON_BY_BUCKET: Record<string, string> = {
  sunny: ICON_PATHS.weatherSunny,
  cloudy: ICON_PATHS.weatherCloudy,
  rain: ICON_PATHS.weatherRain,
};

interface WeatherInfo {
  icon: string;
  label: string;
  temp: number;
}

// API 還沒回來、或查詢失敗時先用縣市名稱算一個固定（非隨機）的假天氣頂著畫面，
// 避免整個天氣小卡在真資料載入前是空的。
function mockWeather(city: string): WeatherInfo {
  let hash = 0;
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const idx = hash % WEATHER_LABELS.length;
  return { icon: WEATHER_ICONS[idx], label: WEATHER_LABELS[idx], temp: 20 + (hash % 10) };
}

// 串中央氣象署開放資料平台的 36 小時天氣預報（依縣市查），查詢中或失敗時退回 mockWeather 佔位，
// 卡片呈現方式不用變。
function useCityWeather(city: string): WeatherInfo {
  const [info, setInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}`)
      .then((res) => res.json())
      .then((data: { bucket?: string; label?: string; temp?: number; error?: string }) => {
        if (cancelled || data.error || data.temp === undefined || !data.bucket) return;
        setInfo({ icon: WEATHER_ICON_BY_BUCKET[data.bucket] ?? ICON_PATHS.weatherCloudy, label: data.label ?? "未知", temp: data.temp });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city]);

  return info ?? mockWeather(city);
}

function resolveStation(cities: Record<string, string[]>, preferred: string | undefined, fallbackIndex: number) {
  const keys = Object.keys(cities);
  if (preferred) {
    const found = keys.find((city) => cities[city].includes(preferred));
    if (found) return { city: found, station: preferred };
  }
  const city = keys[Math.min(fallbackIndex, keys.length - 1)];
  return { city, station: cities[city][0] };
}

export function DreamHomeView() {
  const router = useRouter();
  const { setAction } = usePageAction();
  const [mode, setMode] = useState<Mode>("bus");
  // 火車先用靜態清單墊著畫面，掛載後換成 /api/transit/tra/stations 抓回來的真實 ~240 站清單。
  const [trainCities, setTrainCities] = useState<Record<string, string[]>>(FALLBACK_TRAIN_STATIONS_BY_CITY);
  const initOrigin = resolveStation(STATIONS_BY_CITY.bus, undefined, 0);
  const initDest = resolveStation(STATIONS_BY_CITY.bus, undefined, 1);
  const [originCity, setOriginCity] = useState(initOrigin.city);
  const [origin, setOrigin] = useState(initOrigin.station);
  const [destCity, setDestCity] = useState(initDest.city);
  const [dest, setDest] = useState(initDest.station);
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState(nowHHMM);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const stationLabel = mode === "bus" ? "站牌" : "站";

  // 天氣小卡要能跟出發／抵達站分開設定（使用者編輯預設值時單獨選），不是永遠跟著搜尋表單目前
  // 選的站——所以用自己獨立的 state，不是直接讀 originCity/origin。預設先跟表單一樣，
  // 編輯過後才會分家。
  const initWeatherOrigin = resolveStation(FALLBACK_TRAIN_STATIONS_BY_CITY, undefined, 0);
  const initWeatherDest = resolveStation(FALLBACK_TRAIN_STATIONS_BY_CITY, undefined, 1);
  const [weatherOriginCity, setWeatherOriginCity] = useState(initWeatherOrigin.city);
  const [weatherOriginStation, setWeatherOriginStation] = useState(initWeatherOrigin.station);
  const [weatherDestCity, setWeatherDestCity] = useState(initWeatherDest.city);
  const [weatherDestStation, setWeatherDestStation] = useState(initWeatherDest.station);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const weatherOrigin = useCityWeather(weatherOriginCity);
  const weatherDest = useCityWeather(weatherDestCity);

  const citiesForMode = mode === "train" ? trainCities : STATIONS_BY_CITY[mode];
  // 真實清單載入後 key 可能跟墊檔不一樣，保險起見擋一下，避免 undefined.map 當掉。
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

  // 編輯的設定只影響首頁：掛載時才把「編輯」按鈕插進外殼的切換鈕旁邊，離開首頁（卸載）
  // 就自動收掉，不會跑到我的行程／我的最愛等其他頁面。
  useEffect(() => {
    setAction({ label: "編輯", onClick: () => setSettingsOpen(true) });
    return () => setAction(null);
  }, [setAction]);

  // 進頁面時套用使用者上次存的預設值（本機瀏覽器儲存，純前端偏好值，之後接資料庫/API
  // 時這裡會換成真的使用者設定讀取）。
  useEffect(() => {
    const saved = loadDefaults();
    if (!saved) return;
    // localStorage 是外部、可能被改過或跨版本留下舊格式的資料來源，欄位不能直接信任；
    // 之前就真的發生過改了欄位名稱、舊資料對不上造成整頁壞掉的狀況（defaultTimeSlot→defaultTime），
    // 這裡每個欄位都要個別檢查、缺了就退回安全預設值，不要假設存起來的一定是完整、正確的。
    const validMode = MODES.some((m) => m.key === saved.defaultMode) ? saved.defaultMode : mode;
    // 這幾個 setState 是故意同步呼叫的：頁面掛載後才讀得到 localStorage，讀到就要立刻套用
    // 這組預設值，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable react-hooks/set-state-in-effect */
    selectMode(validMode);
    setTime(saved.defaultTime ?? nowHHMM());
    setWeatherOriginCity(saved.weatherOriginCity ?? initWeatherOrigin.city);
    setWeatherOriginStation(saved.weatherOriginStation ?? initWeatherOrigin.station);
    setWeatherDestCity(saved.weatherDestCity ?? initWeatherDest.city);
    setWeatherDestStation(saved.weatherDestStation ?? initWeatherDest.station);
    /* eslint-enable react-hooks/set-state-in-effect */
    // 這個 effect 故意只在掛載時跑一次：mode/selectMode 讀的是掛載當下的值，
    // 不需要、也不該在使用者之後自己切換運輸工具時重新套用存檔的預設值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSettings(defaults: HomeDefaults) {
    selectMode(defaults.defaultMode);
    setTime(defaults.defaultTime);
    setWeatherOriginCity(defaults.weatherOriginCity);
    setWeatherOriginStation(defaults.weatherOriginStation);
    setWeatherDestCity(defaults.weatherDestCity);
    setWeatherDestStation(defaults.weatherDestStation);
    saveDefaults(defaults);
    setSettingsOpen(false);
  }

  function selectMode(key: Mode) {
    if (key === mode) return;
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

  function swapStations() {
    setOriginCity(destCity);
    setOrigin(dest);
    setDestCity(originCity);
    setDest(origin);
  }

  function searchTrains() {
    router.push(
      `/tools/transit-dream/results?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&mode=${mode}&date=${date}&time=${encodeURIComponent(time)}`,
    );
  }

  return (
    <div className="flex flex-col">
      {/* 這塊之後換成真的插畫圖片（貓咪站長＋火車＋月台），src 留空先顯示柔和漸層佔位。 */}
      <div className="relative h-80 w-full shrink-0 overflow-hidden">
        <ImageSlot alt="夢幻紫彩火車旅行插畫" label="插畫圖片待替換" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
        <div className="absolute left-5 top-6 right-5 text-white drop-shadow-sm">
          <p className="text-2xl font-bold leading-snug">
            下一站， <span aria-hidden>✦</span>
            <br />
            去看更大的世界 <span aria-hidden>✦</span>
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm opacity-90">
            <span aria-hidden>✦</span> 一段旅程，都是生活的延伸 <span aria-hidden>✦</span>
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-16 flex-1 rounded-t-[2rem] bg-white px-5 pb-6 pt-5 shadow-[0_-8px_24px_-8px_rgba(111,95,214,0.2)]">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#F3EFFC] p-3">
          {[
            { station: weatherOriginStation, weather: weatherOrigin },
            { station: weatherDestStation, weather: weatherDest },
          ].map((place, i) => (
            <div key={i} className="flex items-center gap-2">
              <IconImg src={place.weather.icon} alt={place.weather.label} size={28} />
              <div className="min-w-0">
                <p className="truncate text-[11px] text-[#9C94C4]">{place.station}</p>
                <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                  {place.weather.temp}°C・{place.weather.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => selectMode(m.key)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-xs transition-colors ${
                  active ? "bg-[#EFEAFC] font-semibold text-[#6F5FD6]" : "text-[#9C94C4]"
                }`}
              >
                <ImageSlot src={m.icon} alt={`${m.label}圖示`} className="size-6 rounded-lg" />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="relative mt-5 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">出發{stationLabel}</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
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
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
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

          <button
            type="button"
            onClick={swapStations}
            aria-label="交換出發站與抵達站"
            className="absolute right-4 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#ECE4FA] bg-white text-[#6F5FD6] shadow-[0_4px_12px_-4px_rgba(111,95,214,0.4)]"
          >
            ⇄
          </button>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">抵達{stationLabel}</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
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
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
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
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">出發日期</span>
            <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-sm text-[#4A3B7C]">
              <IconImg src={ICON_PATHS.calendar} alt="日期" size={14} />
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-0 flex-1 bg-transparent text-sm font-medium text-[#4A3B7C] outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">時間</span>
            <button
              type="button"
              onClick={() => setTimePickerOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left text-sm text-[#4A3B7C]"
            >
              <IconImg src={ICON_PATHS.clock} alt="時間" size={14} />
              <span className="flex-1 font-medium">{time}</span>
            </button>
          </label>
        </div>

        <TimePickerModal
          key={timePickerOpen ? "time-open" : "time-closed"}
          open={timePickerOpen}
          initial={time}
          onClose={() => setTimePickerOpen(false)}
          onSave={(v) => {
            setTime(v);
            setTimePickerOpen(false);
          }}
        />

        <button
          type="button"
          onClick={searchTrains}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
          style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
        >
          <IconImg src={ICON_PATHS.search} alt="搜尋" size={14} /> 搜尋{MODES.find((m) => m.key === mode)?.label}班次 <span aria-hidden>→</span>
        </button>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} type="button" className="flex flex-col items-center gap-1.5">
              <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-[#F3EFFC]">
                <ImageSlot src={a.icon} alt={`${a.label}圖示`} className="size-6 rounded" />
              </span>
              <span className="text-[11px] text-[#7A71A8]">{a.label}</span>
            </button>
          ))}
        </div>

        <div
          className="mt-5 flex items-center justify-between overflow-hidden rounded-2xl px-5 py-4"
          style={{ background: "linear-gradient(120deg, #A79AEF, #C9A6F2)" }}
        >
          <div>
            <p className="text-base font-bold text-white">週末小旅行</p>
            <p className="mt-0.5 text-xs text-white/85">收藏屬於你的風景 ♡</p>
          </div>
          <div className="flex items-center gap-2">
            <ImageSlot alt="週末小旅行貓咪插畫" className="size-12 rounded-xl" />
            <span aria-hidden className="text-white">
              ›
            </span>
          </div>
        </div>
      </div>

      <HomeSettingsModal
        key={settingsOpen ? "settings-open" : "settings-closed"}
        open={settingsOpen}
        trainCities={trainCities}
        initial={{
          defaultMode: mode,
          defaultTime: time,
          weatherOriginCity,
          weatherOriginStation,
          weatherDestCity,
          weatherDestStation,
        }}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </div>
  );
}
