"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, type Mode } from "@/components/dream/stations-data";
import { DISTRICTS_BY_CITY } from "@/lib/cwa-districts";
import { usePageAction } from "@/components/dream/page-action-context";
import { HomeSettingsModal, type HomeDefaults } from "@/components/dream/home-settings-modal";
import { TimePickerModal } from "@/components/dream/time-picker-modal";
import { DatePickerModal } from "@/components/dream/date-picker-modal";
import { StationPickerModal } from "@/components/dream/station-picker-modal";

const DEFAULTS_KEY = "cpx-tools:transit:home-defaults";

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

const TRAIN_SEARCH_KEY = "cpx-tools:transit:train-last-search";

interface TrainLastSearch {
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  date: string;
}

function loadTrainSearch(): TrainLastSearch | null {
  try {
    const raw = localStorage.getItem(TRAIN_SEARCH_KEY);
    return raw ? (JSON.parse(raw) as TrainLastSearch) : null;
  } catch {
    return null;
  }
}

function saveTrainSearch(search: TrainLastSearch) {
  try {
    localStorage.setItem(TRAIN_SEARCH_KEY, JSON.stringify(search));
  } catch {
    // 同上，存不進去就放著，不影響當下搜尋表單的操作。
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

// 跟「我的最愛」頁面同一組假資料，純展示用，之後要接真的常用路線資料再換掉。
const FREQUENT_ROUTES = [
  { origin: "台北站", dest: "台中站", duration: "約 2 小時 8 分" },
  { origin: "台北站", dest: "高雄站", duration: "約 1 小時 36 分" },
  { origin: "台中站", dest: "花蓮站", duration: "約 2 小時 34 分" },
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

// 查詢「失敗」時（不是還在查詢中）才用縣市名稱算一個固定（非隨機）的假天氣頂著畫面，
// 避免整個天氣小卡壞掉時是空的。這跟「查詢中」是不同的狀態——查詢中要讓畫面顯示
// 「載入中」，不能先塞這組假資料，不然等真資料回來會整個跳掉、看起來像資料閃爍。
function mockWeather(city: string): WeatherInfo {
  let hash = 0;
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const idx = hash % WEATHER_LABELS.length;
  return { icon: WEATHER_ICONS[idx], label: WEATHER_LABELS[idx], temp: 20 + (hash % 10) };
}

// 串中央氣象署開放資料平台的鄉鎮天氣預報（依縣市＋鄉鎮區查，比只到縣市等級的 36 小時
// 預報更精確）。回傳 null 代表「還在查詢中」，呼叫端要自己顯示「載入中」之類的文字，
// 不要在這裡先塞假資料頂著——查詢失敗（真的查不到）才落到 mockWeather，那是查過一次
// 就不會再變的最終狀態，不會有「假資料又被真資料蓋掉」這種閃爍問題。
function useCityWeather(city: string, district: string): WeatherInfo | null {
  const [info, setInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    // city/district 一變就要重新查，故意同步把上一次的結果清掉讓畫面回到查詢中狀態，
    // 不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(null);
    fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`)
      .then((res) => res.json())
      .then((data: { bucket?: string; label?: string; temp?: number; error?: string }) => {
        if (cancelled) return;
        if (data.error || data.temp === undefined || !data.bucket) {
          setInfo(mockWeather(city));
          return;
        }
        setInfo({ icon: WEATHER_ICON_BY_BUCKET[data.bucket] ?? ICON_PATHS.weatherCloudy, label: data.label ?? "未知", temp: data.temp });
      })
      .catch(() => {
        if (!cancelled) setInfo(mockWeather(city));
      });
    return () => {
      cancelled = true;
    };
  }, [city, district]);

  return info;
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);

  // 天氣小卡要能跟出發／抵達站分開設定（使用者編輯預設值時單獨選），不是永遠跟著搜尋表單目前
  // 選的站——所以用自己獨立的 state，不是直接讀 originCity/origin。天氣是用縣市＋鄉鎮區查，
  // 跟搜尋表單選的「火車站」是兩套完全不同的清單（行政區不等於車站）。
  const initWeatherOrigin = resolveStation(DISTRICTS_BY_CITY, undefined, 0);
  const initWeatherDest = resolveStation(DISTRICTS_BY_CITY, undefined, 1);
  const [weatherOriginCity, setWeatherOriginCity] = useState(initWeatherOrigin.city);
  const [weatherOriginDistrict, setWeatherOriginDistrict] = useState(initWeatherOrigin.station);
  const [weatherDestCity, setWeatherDestCity] = useState(initWeatherDest.city);
  const [weatherDestDistrict, setWeatherDestDistrict] = useState(initWeatherDest.station);
  // 剛掛載、還沒讀完 localStorage 偏好值之前，天氣小卡的縣市／行政區文字先顯示「載入中…」，
  // 不要顯示 initWeatherOrigin/initWeatherDest 算出來的寫死預設值（DISTRICTS_BY_CITY 表
  // 第一筆剛好是宜蘭縣宜蘭市）——不然會先閃一下這個不是使用者設定、也不是真的查詢結果的
  // 地名，看起來像是哪裡冒出來的錯誤資料。這個 state 故意不用 localStorage 同步讀（useState
  // 初始值裡讀），因為這個頁面會先在伺服器端渲染一次，伺服器端沒有 localStorage，會跟瀏覽器
  // 端算出來的結果不一致、觸發 hydration 不匹配；用「掛載後才翻成 true」这个效果本身跟
  // hydration 無關，比較安全。
  const [weatherReady, setWeatherReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 點「編輯」開彈窗那一刻的天氣設定快照，使用者點「取消」時要能還原回這個狀態
  // （彈窗內改天氣地區會即時套用到首頁，不是等按「儲存」才生效）。
  const [weatherSnapshot, setWeatherSnapshot] = useState<{
    weatherOriginCity: string;
    weatherOriginDistrict: string;
    weatherDestCity: string;
    weatherDestDistrict: string;
  } | null>(null);
  const weatherOrigin = useCityWeather(weatherOriginCity, weatherOriginDistrict);
  const weatherDest = useCityWeather(weatherDestCity, weatherDestDistrict);

  // 用 ref 存最新天氣設定，讓下面只跑一次的「掛載編輯按鈕」effect 在使用者點擊當下
  // 也能讀到最新值，不用把這幾個常變動的 state 加進 effect 的依賴陣列。
  const weatherStateRef = useRef({ weatherOriginCity, weatherOriginDistrict, weatherDestCity, weatherDestDistrict });
  weatherStateRef.current = { weatherOriginCity, weatherOriginDistrict, weatherDestCity, weatherDestDistrict };

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
    setAction({
      label: "編輯",
      onClick: () => {
        setWeatherSnapshot(weatherStateRef.current);
        setSettingsOpen(true);
      },
    });
    return () => setAction(null);
  }, [setAction]);

  // 進頁面時套用使用者上次存的預設值（本機瀏覽器儲存，純前端偏好值，之後接資料庫/API
  // 時這裡會換成真的使用者設定讀取）。
  useEffect(() => {
    const saved = loadDefaults();
    if (!saved) {
      // 一樣是掛載時的一次性初始化，理由跟下面那一大段 disable 註解相同。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeatherReady(true);
      return;
    }
    // localStorage 是外部、可能被改過或跨版本留下舊格式的資料來源，欄位不能直接信任；
    // 之前就真的發生過改了欄位名稱、舊資料對不上造成整頁壞掉的狀況（defaultTimeSlot→defaultTime）。
    // city 跟 district 是一組的，不能各自獨立 fallback——不然舊資料裡存的 city 配新預設值的
    // district，兩個湊起來會變成一個不存在的組合（例如「桃園市」配「宜蘭市」），要整組一起驗證、
    // 整組一起退回安全預設值。
    const validMode = MODES.some((m) => m.key === saved.defaultMode) ? saved.defaultMode : mode;
    const originValid = saved.weatherOriginCity && DISTRICTS_BY_CITY[saved.weatherOriginCity]?.includes(saved.weatherOriginDistrict);
    const destValid = saved.weatherDestCity && DISTRICTS_BY_CITY[saved.weatherDestCity]?.includes(saved.weatherDestDistrict);
    // 這幾個 setState 是故意同步呼叫的：頁面掛載後才讀得到 localStorage，讀到就要立刻套用
    // 這組預設值，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    selectMode(validMode);
    setWeatherOriginCity(originValid ? saved.weatherOriginCity : initWeatherOrigin.city);
    setWeatherOriginDistrict(originValid ? saved.weatherOriginDistrict : initWeatherOrigin.station);
    setWeatherDestCity(destValid ? saved.weatherDestCity : initWeatherDest.city);
    setWeatherDestDistrict(destValid ? saved.weatherDestDistrict : initWeatherDest.station);
    setWeatherReady(true);
    // 這個 effect 故意只在掛載時跑一次：mode/selectMode 讀的是掛載當下的值，
    // 不需要、也不該在使用者之後自己切換運輸工具時重新套用存檔的預設值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSettings(defaults: HomeDefaults) {
    selectMode(defaults.defaultMode);
    // 天氣地區在彈窗內已經即時套用過了，這裡只是把同一組值連同運輸工具一起寫進 localStorage。
    setWeatherOriginCity(defaults.weatherOriginCity);
    setWeatherOriginDistrict(defaults.weatherOriginDistrict);
    setWeatherDestCity(defaults.weatherDestCity);
    setWeatherDestDistrict(defaults.weatherDestDistrict);
    saveDefaults(defaults);
    setSettingsOpen(false);
  }

  // 點「取消」或背景、右上角 ✕ 關閉彈窗：天氣地區要還原回剛打開彈窗那一刻的狀態
  // （彈窗內改地區是即時套用到首頁的，沒按「儲存」就要能整組復原）。
  function closeSettings() {
    if (weatherSnapshot) {
      setWeatherOriginCity(weatherSnapshot.weatherOriginCity);
      setWeatherOriginDistrict(weatherSnapshot.weatherOriginDistrict);
      setWeatherDestCity(weatherSnapshot.weatherDestCity);
      setWeatherDestDistrict(weatherSnapshot.weatherDestDistrict);
    }
    setSettingsOpen(false);
  }

  function selectMode(key: Mode) {
    if (key === mode) return;
    setMode(key);
    // 火車模式改用「記住上次查詢」：有存過合法的上次搜尋狀態就直接還原，
    // 不然才退回該模式清單裡的第一、第二個站當預設。
    if (key === "train") {
      const saved = loadTrainSearch();
      // 這裡故意不檢查站名是否存在於目前的 trainCities——掛載時真實的 ~240 站清單
      // 可能還沒從 API 載回來（還是 FALLBACK_TRAIN_STATIONS_BY_CITY 那個只有 8 個城市、
      // 每城 2 站的墊檔清單），存起來的站名幾乎都不在裡面，查這個反而會讓還原失敗。
      // saved 是自己寫入的本機資料，直接信任；真的對不上時畫面上的 safeOriginCity／
      // safeDestCity 容錯邏輯會接手，不會整頁壞掉。
      if (saved) {
        setOriginCity(saved.originCity);
        setOrigin(saved.origin);
        setDestCity(saved.destCity);
        setDest(saved.dest);
        setDate(saved.date || todayLocal());
        // 時間不記住——每次進來都先用現在的時間頂著，使用者想要別的時間自己調，
        // 不要讓很久以前選過的一個時間點一直陰魂不散地出現在新的一次查詢裡。
        setTime(nowHHMM());
        return;
      }
    }
    const cities = key === "train" ? trainCities : STATIONS_BY_CITY[key];
    const keys = Object.keys(cities);
    const oCity = keys[0];
    const dCity = keys[1] ?? keys[0];
    setOriginCity(oCity);
    setOrigin(cities[oCity][0]);
    setDestCity(dCity);
    setDest(cities[dCity][dCity === oCity && cities[dCity].length > 1 ? 1 : 0]);
  }

  // 火車模式下，出發／抵達站、日期只要變動就存起來，下次切回火車模式會自動還原，不用
  // 另外在編輯彈窗裡設「預設站牌」。時間故意不存——時間欄位永遠先顯示現在的時間，
  // 使用者想要別的時間自己調（見 selectMode 裡的說明）。
  useEffect(() => {
    if (mode !== "train") return;
    saveTrainSearch({ originCity, origin, destCity, dest, date });
  }, [mode, originCity, origin, destCity, dest, date]);

  function swapStations() {
    setOriginCity(destCity);
    setOrigin(dest);
    setDestCity(originCity);
    setDest(origin);
  }

  function searchTrains() {
    router.push(
      `/tools/transit/results?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&mode=${mode}&date=${date}&time=${encodeURIComponent(time)}`,
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
            { label: weatherReady ? `${weatherOriginCity} ${weatherOriginDistrict}` : "載入中…", weather: weatherOrigin },
            { label: weatherReady ? `${weatherDestCity} ${weatherDestDistrict}` : "載入中…", weather: weatherDest },
          ].map((place, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* 跟「週末小旅行」那塊同一種佔位風格（ImageSlot：漸層底＋🖼️），圖還沒上傳時
                  看起來明顯是「待替換的圖片格」，不是 IconImg 那種看不出來是圖片格的純色方塊。 */}
              {place.weather && <ImageSlot src={place.weather.icon} alt={place.weather.label} className="size-7 shrink-0 rounded-lg" />}
              <div className="min-w-0">
                <p className="truncate text-[11px] text-[#9C94C4]">{place.label}</p>
                <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                  {/* 查詢中先顯示「載入中」，不要先塞假資料再被真資料蓋掉，看起來會像閃一下。 */}
                  {place.weather ? `${place.weather.temp}°C・${place.weather.label}` : "載入中…"}
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
            <button type="button" onClick={() => setOriginPickerOpen(true)} className="grid grid-cols-2 gap-2 text-left">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeOriginCity}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{origin}</span>
              </div>
            </button>
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
            <button type="button" onClick={() => setDestPickerOpen(true)} className="grid grid-cols-2 gap-2 text-left">
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                <IconImg src={ICON_PATHS.pin} alt="地點" size={14} />
                <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeDestCity}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{dest}</span>
              </div>
            </button>
          </label>
        </div>

        <StationPickerModal
          key={originPickerOpen ? "origin-open" : "origin-closed"}
          open={originPickerOpen}
          title={`選擇出發${stationLabel}`}
          cities={citiesForMode}
          initialCity={safeOriginCity}
          initialStation={origin}
          onClose={() => setOriginPickerOpen(false)}
          onSave={(city, station) => {
            setOriginCity(city);
            setOrigin(station);
            setOriginPickerOpen(false);
          }}
        />
        <StationPickerModal
          key={destPickerOpen ? "dest-open" : "dest-closed"}
          open={destPickerOpen}
          title={`選擇抵達${stationLabel}`}
          cities={citiesForMode}
          initialCity={safeDestCity}
          initialStation={dest}
          onClose={() => setDestPickerOpen(false)}
          onSave={(city, station) => {
            setDestCity(city);
            setDest(station);
            setDestPickerOpen(false);
          }}
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">出發日期</span>
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left text-sm text-[#4A3B7C]"
            >
              <IconImg src={ICON_PATHS.calendar} alt="日期" size={14} />
              <span className="flex-1 truncate font-medium">{date.replaceAll("-", "/")}</span>
            </button>
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

        <DatePickerModal
          key={datePickerOpen ? "date-open" : "date-closed"}
          open={datePickerOpen}
          initial={date}
          onClose={() => setDatePickerOpen(false)}
          onSave={(v) => {
            setDate(v);
            setDatePickerOpen(false);
          }}
        />

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

        {/* 常用路線：先照「我的最愛」頁面同一塊搬過來，純展示用的假資料，不串任何 API，
            之後樣式會再陸續調整。 */}
        <div className="mt-5 flex flex-col gap-2.5">
          {FREQUENT_ROUTES.map((r, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
              <ImageSlot alt={`${r.origin}到${r.dest}`} className="size-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#4A3B7C]">
                  {r.origin} <span aria-hidden>⇄</span> {r.dest}
                  <IconImg src={ICON_PATHS.heartFilled} alt="已收藏" size={14} />
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9C94C4]">
                  <IconImg src={ICON_PATHS.clock} alt="時間" size={12} /> {r.duration}
                </p>
              </div>
              <button type="button" className="shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]">
                搜尋班次 →
              </button>
            </div>
          ))}
        </div>
      </div>

      <HomeSettingsModal
        key={settingsOpen ? "settings-open" : "settings-closed"}
        open={settingsOpen}
        initial={{
          defaultMode: mode,
          weatherOriginCity,
          weatherOriginDistrict,
          weatherDestCity,
          weatherDestDistrict,
        }}
        onClose={closeSettings}
        onSave={saveSettings}
        onPreviewOriginCity={setWeatherOriginCity}
        onPreviewOriginDistrict={setWeatherOriginDistrict}
        onPreviewDestCity={setWeatherDestCity}
        onPreviewDestDistrict={setWeatherDestDistrict}
      />
    </div>
  );
}
