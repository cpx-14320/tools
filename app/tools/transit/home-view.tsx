"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, type Mode } from "@/components/dream/stations-data";
import { DISTRICTS_BY_CITY } from "@/lib/cwa-districts";
import { HomeSettingsModal, type HomeDefaults } from "@/components/dream/home-settings-modal";
import { TimePickerModal } from "@/components/dream/time-picker-modal";
import { DatePickerModal } from "@/components/dream/date-picker-modal";
import { StationPickerModal } from "@/components/dream/station-picker-modal";
import { MemoEditorModal, type MemoDraft } from "@/components/dream/memo-editor-modal";
import { memoIconPath } from "@/components/dream/memo-icons";
import { WeatherCarousel, type WeatherBlock } from "@/components/dream/weather-carousel";

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

// 前端用的輕量備忘錄型別，故意不從 lib/memos.ts 匯入——那個檔案會連到 mongodb 驅動程式，
// 絕不能進到 "use client" 檔案（會把伺服器端套件打包進前端 bundle）。
interface Memo {
  id: string;
  content: string;
  icon: string;
  remindAt: string | null;
}

type RemindTone = "soon" | "later";

// 跟我的行程頁面卡片徽章同一種「圓角淡色底」視覺語言，這裡獨立定義一份，不直接
// import 那個檔案裡的常數（兩邊是不同頁面，不應該互相耦合）。
const REMIND_TONE_STYLE: Record<RemindTone, string> = {
  soon: "bg-[#DFF4EB] text-[#2FAE82]",
  later: "bg-[#F3EFFC] text-[#9C94C4]",
};

// remindAt 已經過去就算「soon」（用同一個醒目色調提示使用者已經逾期），24 小時內也算
// soon，再久一點才轉成 later 那種比較不急迫的淡色。
function formatRemindCountdown(remindAtIso: string): { text: string; tone: RemindTone } {
  const diffMs = new Date(remindAtIso).getTime() - Date.now();
  if (diffMs <= 0) return { text: "已逾期", tone: "soon" };
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const text = days > 0 ? `還有 ${days} 天 ${hours} 小時` : `還有 ${hours} 小時`;
  return { text, tone: days === 0 ? "soon" : "later" };
}

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
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoEditorOpen, setMemoEditorOpen] = useState(false);

  // 掛載時抓一次使用者自己的備忘錄；儲存後也會用同一份 API 回應直接更新畫面，不用重抓。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/memos")
      .then((res) => res.json())
      .then((data: { memos?: Memo[] }) => {
        if (!cancelled) setMemos(data.memos ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // datetime-local 的值是瀏覽器所在時區的本地時間字串，沒有填就是空字串；送去 API 前
  // 轉成帶時區資訊的 ISO 字串（.toISOString()），這一步要在瀏覽器端做——伺服器收到裸的
  // "YYYY-MM-DDTHH:mm" 字串時是用伺服器自己的時區去解讀，跟使用者選的時間可能會對不上。
  function saveMemos(drafts: MemoDraft[]) {
    const items = drafts.map((d) => ({
      id: d.id,
      content: d.content,
      icon: d.icon,
      remindAt: d.remindAt ? new Date(d.remindAt).toISOString() : null,
    }));
    fetch("/api/transit/memos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((res) => res.json())
      .then((data: { memos?: Memo[] }) => setMemos(data.memos ?? []))
      .catch(() => {});
    setMemoEditorOpen(false);
  }
  const stationLabel = "站";
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);

  // 天氣卡改成使用者自訂、可新增任意多個「區塊」的清單（像「我的行程」的分類一樣），
  // 不是寫死出發／抵達兩個固定欄位；每個區塊是一個縣市＋行政區，會自動展開成「今天」
  // 「明天」兩張首頁輪播卡，不用另外選日期。剛創帳號、還沒存過任何偏好值時，預設兩個
  // 區塊（桃園市中壢區、臺北市南港區，各自今天＋明天共 4 張卡），不是隨便挑
  // DISTRICTS_BY_CITY 表裡第一筆（以前曾經是宜蘭縣宜蘭市，跟使用者實際常用的地點完全
  // 無關，容易被誤會成查詢結果本身有問題）。
  function defaultWeatherBlocks(): WeatherBlock[] {
    return [
      { id: "default-origin", city: "桃園市", district: "中壢區" },
      { id: "default-dest", city: "臺北市", district: "南港區" },
    ];
  }
  const [weatherBlocks, setWeatherBlocks] = useState<WeatherBlock[]>(defaultWeatherBlocks);
  // 剛掛載、還沒讀完 localStorage 偏好值之前，天氣卡先顯示「載入中…」，不要先顯示
  // defaultWeatherBlocks() 算出來的預設值——不然會先閃一下這組預設值再被使用者實際
  // 存的偏好值蓋掉，看起來像資料閃爍。這個 state 故意不用 localStorage 同步讀（useState
  // 初始值裡讀），因為這個頁面會先在伺服器端渲染一次，伺服器端沒有 localStorage，會跟瀏覽器
  // 端算出來的結果不一致、觸發 hydration 不匹配；用「掛載後才翻成 true」这个效果本身跟
  // hydration 無關，比較安全。
  const [weatherReady, setWeatherReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  function openSettings() {
    setSettingsOpen(true);
  }

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
    // 每個區塊的 city/district 也是一組的，不能各自獨立 fallback，要整個區塊一起驗證，
    // 驗證不過的整個丟掉；驗證完一個都不剩才退回預設的兩個區塊。
    const validMode = MODES.some((m) => m.key === saved.defaultMode) ? saved.defaultMode : mode;
    const validBlocks = Array.isArray(saved.weatherBlocks)
      ? saved.weatherBlocks.filter(
          (b): b is WeatherBlock =>
            !!b &&
            typeof b.id === "string" &&
            typeof b.city === "string" &&
            typeof b.district === "string" &&
            !!DISTRICTS_BY_CITY[b.city]?.includes(b.district),
        )
      : [];
    // 這幾個 setState 是故意同步呼叫的：頁面掛載後才讀得到 localStorage，讀到就要立刻套用
    // 這組預設值，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    selectMode(validMode);
    setWeatherBlocks(validBlocks.length > 0 ? validBlocks : defaultWeatherBlocks());
    setWeatherReady(true);
    // 這個 effect 故意只在掛載時跑一次：mode/selectMode 讀的是掛載當下的值，
    // 不需要、也不該在使用者之後自己切換運輸工具時重新套用存檔的預設值。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSettings(defaults: HomeDefaults) {
    selectMode(defaults.defaultMode);
    setWeatherBlocks(defaults.weatherBlocks);
    saveDefaults(defaults);
    setSettingsOpen(false);
  }

  function closeSettings() {
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
      <div className="relative h-80 w-full shrink-0 overflow-hidden">
        <ImageSlot src={ICON_PATHS.heroMain} alt="夢幻紫彩火車旅行插畫" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
        {/* 跟著首頁內容一起捲動，不是外殼層級的 fixed／absolute 覆蓋層，滑動時不會貼著螢幕
            右上角不動。 */}
        <button
          type="button"
          onClick={openSettings}
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-[#ECE4FA] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#6F5FD6] shadow-sm backdrop-blur"
        >
          編輯
        </button>
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
        <div className="mb-4">
          {weatherReady ? <WeatherCarousel blocks={weatherBlocks} /> : <p className="rounded-2xl bg-[#F3EFFC] px-3 py-4 text-center text-xs text-[#B3ABD4]">載入中…</p>}
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
                <ImageSlot src={m.icon} alt={`${m.label}圖示`} className="size-10 rounded-lg" />
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
            <span className="text-xs font-medium text-[#9C94C4]">日期</span>
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

        <div className="relative mt-5 h-28 overflow-hidden rounded-2xl">
          {/* 整個卡片背景換成真圖，不是右邊一個小圖示；圖還沒上傳前 ImageSlot 會自動退回
              漸層佔位，所以這裡不用再額外寫死一層漸層背景。 */}
          <ImageSlot src={ICON_PATHS.weekendTripBanner} alt="週末小旅行" className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
          <div className="relative z-10 flex h-full items-center justify-between px-5 py-4">
            <div>
              <p className="text-base font-bold text-white">週末小旅行</p>
              <p className="mt-0.5 text-xs text-white/85">收藏屬於你的風景 ♡</p>
            </div>
            <span aria-hidden className="text-white">
              ›
            </span>
          </div>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
          <span aria-hidden className="text-[#C9A6F2]">
            ♦
          </span>
          小小備忘錄
          <button type="button" onClick={() => setMemoEditorOpen(true)} aria-label="編輯備忘錄" className="ml-auto">
            <IconImg src={ICON_PATHS.edit} alt="編輯" size={14} />
          </button>
        </p>
        {memos.length === 0 ? (
          <p className="mt-2 text-xs text-[#B3ABD4]">還沒有備忘錄，點右上角新增</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2.5">
            {memos.map((m) => {
              const countdown = m.remindAt ? formatRemindCountdown(m.remindAt) : null;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
                  <ImageSlot src={memoIconPath(m.icon)} alt="備忘錄" className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="mt-0.5 truncate text-xs text-[#9C94C4]">{m.content}</p>
                    {countdown && (
                      <span className={`mt-1.5 inline-block w-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${REMIND_TONE_STYLE[countdown.tone]}`}>
                        {countdown.text}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MemoEditorModal
        key={memoEditorOpen ? "memo-open" : "memo-closed"}
        open={memoEditorOpen}
        initial={memos}
        onClose={() => setMemoEditorOpen(false)}
        onSave={saveMemos}
      />

      <HomeSettingsModal
        key={settingsOpen ? "settings-open" : "settings-closed"}
        open={settingsOpen}
        initial={{ defaultMode: mode, weatherBlocks }}
        onClose={closeSettings}
        onSave={saveSettings}
      />
    </div>
  );
}
