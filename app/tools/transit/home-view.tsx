"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSlot } from "@/components/dream/image-slot";
import { FaIcon } from "@/components/dream/fa-icon";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY, destCitiesFor, type Mode } from "@/components/dream/stations-data";
import { DISTRICTS_BY_CITY } from "@/lib/cwa-districts";
import { HomeSettingsModal, type HomeDefaults } from "@/components/dream/home-settings-modal";
import { TimePickerModal } from "@/components/dream/time-picker-modal";
import { DatePickerModal } from "@/components/dream/date-picker-modal";
import { StationPickerModal } from "@/components/dream/station-picker-modal";
import { BusRoutePickerModal, routeBadgeStyle, type BusRouteSelection } from "@/components/dream/bus-route-picker-modal";
import { MemoEditorModal, type MemoDraft } from "@/components/dream/memo-editor-modal";
import { memoIconPath } from "@/components/dream/memo-icons";
import { WeatherCarousel, WeatherCarouselSkeleton, type WeatherBlock } from "@/components/dream/weather-carousel";
import { ListRowSkeleton } from "@/components/dream/list-row-skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "@/components/dream/skeleton-count";
const DEFAULTS_KEY = "cpx-tools:transit:home-defaults";
// 小小備忘錄是使用者自己增減的清單，筆數會變動，骨架列數用這個 key 記住上次實際筆數；
// 完全沒存過（第一次使用）時先猜 2 則。
const MEMOS_COUNT_KEY = "cpx-tools:transit:memos-count";
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
// 不再用「編輯首頁預設值」裡設定的固定預設運輸工具——那個值只有使用者自己回來改設定
// 才會變，跟使用者實際常切換的分頁容易對不起來，每次重新整理都跳回設定值會讓人覺得
// 「怎麼又切換了」。改成單純記住使用者最後一次停留的分頁，每次切換分頁就更新，重新
// 整理後直接還原到離開前的狀態。
const LAST_MODE_KEY = "cpx-tools:transit:last-mode";
function loadLastMode(): Mode | null {
  try {
    const raw = localStorage.getItem(LAST_MODE_KEY);
    return MODES.some((m) => m.key === raw) ? (raw as Mode) : null;
  } catch {
    return null;
  }
}
function saveLastMode(mode: Mode) {
  try {
    localStorage.setItem(LAST_MODE_KEY, mode);
  } catch {
    // 同上，私密瀏覽模式等情況下存不了就算了。
  }
}
const TRAIN_SEARCH_KEY = "cpx-tools:transit:train-last-search";
interface TrainLastSearch {
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
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
// 捷運／高鐵跟火車一樣用「記住上次查詢」：選項不少（捷運 7 個系統、上百個站；高鐵現在
// 12 站），每次切回來都要重新選很煩，記住上次選的出發／抵達站就好，不像火車還要記日期
// ——使用者要的是「上次選的站點」，日期／時間本來就是每次查詢當下才決定，沒有需要記上次
// 選的值。兩個車種的存檔形狀一樣，共用同一組讀寫函式，只是各自存在不同的 key，不用為
// 高鐵再複製一份幾乎一樣的程式碼。
const METRO_SEARCH_KEY = "cpx-tools:transit:metro-last-search";
const THSR_SEARCH_KEY = "cpx-tools:transit:thsr-last-search";
interface StationOnlyLastSearch {
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
}
function loadStationOnlySearch(key: string): StationOnlyLastSearch | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StationOnlyLastSearch) : null;
  } catch {
    return null;
  }
}
function saveStationOnlySearch(key: string, search: StationOnlyLastSearch) {
  try {
    localStorage.setItem(key, JSON.stringify(search));
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
// 前端用的輕量備忘錄型別，故意不從 lib/memos.ts 匯入——那個檔案會連到 mongodb 驅動程式，
// 絕不能進到 "use client" 檔案（會把伺服器端套件打包進前端 bundle）。
interface Memo {
  id: string;
  content: string;
  icon: string;
  remindAt: string | null;
}
// 同上，故意不從 lib/weekend-trips.ts 匯入。
interface WeekendTrip {
  id: string;
  title: string;
  caption: string;
  image: string;
}
// 首頁最上方插畫 Banner 的文案／圖片，邏輯跟 WeekendTrip 一樣，故意不從 lib/hero-banners.ts
// 匯入。
interface HeroBanner {
  id: string;
  title: string;
  caption: string;
  image: string;
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
  // 初次 render 先讓內容照常顯示，不隱藏整個模式區塊。
  // 只有在確認 localStorage 裡使用者最後停留的模式後，才顯示選中背景色。
  const [modeReady, setModeReady] = useState(false);
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
  const [memosReady, setMemosReady] = useState(false);
  // 初始值只能先給固定的 0（伺服器端渲染那一次沒有 localStorage，要跟瀏覽器端算出來的
  // 結果一致才不會 hydration 不匹配），掛載後才用下面的 effect 翻成真的猜測值；退回 0
  // 時畫面上顯示「載入中」文字，不要誤猜一個固定數字的骨架——新帳號根本還沒有備忘錄，
  // 最後只會顯示一段「還沒有備忘錄」文字，載入中卻先看到幾排骨架會很奇怪。
  const [memosSkeletonCount, setMemosSkeletonCount] = useState(0);
  const [memoEditorOpen, setMemoEditorOpen] = useState(false);
  const [weekendTrips, setWeekendTrips] = useState<WeekendTrip[]>([]);
  // 每次進頁面／重新整理都要重新抽一則，不是整天固定同一則——跟 weekendTrips 分開存，
  // 抽完之後除非重新整理（這個元件重新掛載），不會因為其他跟這個區塊無關的畫面更新
  // （例如使用者在表單打字）又重新算一次、害顯示的那則一直跳動。
  const [weekendTripIndex, setWeekendTripIndex] = useState<number | null>(null);
  // 抓清單那個 fetch 完成前，先不要顯示任何文案——原本掛載時就直接顯示寫死的預設文案，
  // fetch 回來才切成抽到的那組，使用者會看到文字在載入瞬間「跳一下」；改成空白／骨架，
  // 等 fetch 真的有結果（不管是抽到自訂的還是退回預設）才一次顯示最終內容。
  const [weekendReady, setWeekendReady] = useState(false);
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([]);
  // 跟 weekendTripIndex 同一套做法：抽完之後只要這個元件沒重新掛載就不會再變。
  const [heroBannerIndex, setHeroBannerIndex] = useState<number | null>(null);
  const [heroReady, setHeroReady] = useState(false);
  // 日期欄位的初始值只在掛載那一刻算一次，分頁開著跨過半夜沒重新整理的話，日期會一直卡在
  // 「昨天」——除了搜尋當下會自動校正（見 searchTrains），分頁從背景切回來時也順便校正一次，
  // 不要讓使用者看到畫面上日期欄位顯示昨天的日期才覺得奇怪。只往前校正：使用者自己選了
  // 未來日期的話不要動，只有「已經變成過去」才需要糾正。
  useEffect(() => {
    function syncDateIfStale() {
      if (document.visibilityState !== "visible") return;
      const today = todayLocal();
      setDate((d) => (d < today ? today : d));
    }
    document.addEventListener("visibilitychange", syncDateIfStale);
    return () => document.removeEventListener("visibilitychange", syncDateIfStale);
  }, []);
  useEffect(() => {
    // 跟首頁套用 localStorage 存的預設值同一種例外：掛載後才讀得到 localStorage，讀到就要
    // 立刻套用這個猜測值，不是在訂閱外部事件、也不會連鎖觸發其他 effect。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMemosSkeletonCount(loadSkeletonCount(MEMOS_COUNT_KEY, 0));
  }, []);
  // 掛載時抓一次使用者自己的備忘錄；儲存後也會用同一份 API 回應直接更新畫面，不用重抓。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/memos")
      .then((res) => res.json())
      .then((data: { memos?: Memo[] }) => {
        if (cancelled) return;
        const items = data.memos ?? [];
        setMemos(items);
        setMemosReady(true);
        saveSkeletonCount(MEMOS_COUNT_KEY, items.length);
      })
      .catch(() => {
        if (!cancelled) setMemosReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // 「週末小旅行」可選的文案＋背景圖，掛載時抓一次並隨機抽一則；使用者還沒在「其他」頁
  // 設定過的話會是空陣列，畫面上退回原本寫死的那組（見下面 todayWeekendTrip）。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/weekend-trips")
      .then((res) => res.json())
      .then((data: { items?: WeekendTrip[] }) => {
        if (cancelled) return;
        const items = data.items ?? [];
        setWeekendTrips(items);
        if (items.length > 0) setWeekendTripIndex(Math.floor(Math.random() * items.length));
        setWeekendReady(true);
      })
      .catch(() => {
        if (!cancelled) setWeekendReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // 首頁最上方插畫 Banner 可選的文案＋背景圖，邏輯跟上面的週末小旅行完全一樣。
  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/hero-banners")
      .then((res) => res.json())
      .then((data: { items?: HeroBanner[] }) => {
        if (cancelled) return;
        const items = data.items ?? [];
        setHeroBanners(items);
        if (items.length > 0) setHeroBannerIndex(Math.floor(Math.random() * items.length));
        setHeroReady(true);
      })
      .catch(() => {
        if (!cancelled) setHeroReady(true);
      });
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
      .then((data: { memos?: Memo[] }) => {
        const result = data.memos ?? [];
        setMemos(result);
        saveSkeletonCount(MEMOS_COUNT_KEY, result.length);
      })
      .catch(() => { });
    setMemoEditorOpen(false);
  }
  const stationLabel = "站";
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [originPickerOpen, setOriginPickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  // 公車改成「路線優先」搜尋（UI 階段，見 bus-route-picker-modal.tsx），不是出發／抵達站
  // 兩個下拉選單，所以另外用一組獨立的 state，不跟 origin/dest 共用。
  const [busSelection, setBusSelection] = useState<BusRouteSelection | null>(null);
  const [busPickerOpen, setBusPickerOpen] = useState(false);
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
  const destCitiesForMode = destCitiesFor(mode, safeOriginCity, citiesForMode);
  const safeDestCity = destCitiesForMode[destCity] ? destCity : Object.keys(destCitiesForMode)[0];
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
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);
  function openSettings() {
    setSettingsOpen(true);
  }
  // 進頁面時套用使用者上次存的天氣地區設定（本機瀏覽器儲存，純前端偏好值，之後接
  // 資料庫/API 時這裡會換成真的使用者設定讀取）。
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
    // 這個 setState 是故意同步呼叫的：頁面掛載後才讀得到 localStorage，讀到就要立刻套用
    // 這組預設值，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    setWeatherBlocks(validBlocks.length > 0 ? validBlocks : defaultWeatherBlocks());
    setWeatherReady(true);
  }, []);
  // 進頁面時還原使用者最後一次停留的運輸工具分頁，不是套用「編輯首頁預設值」裡的固定
  // 設定——理由見 loadLastMode 旁的註解。跟上面天氣地區那個 effect 分開寫，因為這個只
  // 在掛載時跑一次、讀的是掛載當下的 mode 比對是否要切換，兩者各自獨立的初始化，合在
  // 一起反而容易互相牽扯。
  useEffect(() => {
    const saved = loadLastMode();
    if (saved) selectMode(saved);
    // 讀取完成前，所有模式都不顯示選中背景；
    // 沒有紀錄的新使用者則維持 bus，這裡完成後才讓 bus 顯示選中。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function saveSettings(defaults: HomeDefaults) {
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
    saveLastMode(key);
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
        // 日期／時間都不記住——每次進來都先用現在的日期、時間頂著，使用者想要別的
        // 日期／時間自己調。日期要是記了上次存的值，分頁開著跨過半夜沒重新整理再切回
        // 火車模式，就會還原出一個已經過去的日期，查真實時刻表會直接被 TDX 擋掉。
        setDate(todayLocal());
        setTime(nowHHMM());
        return;
      }
    }
    // 捷運／高鐵同一套道理，只是不用記日期（日期本來就是每次查詢當下決定，不用還原成
    // 上次的）。
    if (key === "metro" || key === "thsr") {
      const saved = loadStationOnlySearch(key === "metro" ? METRO_SEARCH_KEY : THSR_SEARCH_KEY);
      if (saved) {
        setOriginCity(saved.originCity);
        setOrigin(saved.origin);
        setDestCity(saved.destCity);
        setDest(saved.dest);
        return;
      }
    }
    const cities = key === "train" ? trainCities : STATIONS_BY_CITY[key];
    const keys = Object.keys(cities);
    const oCity = keys[0];
    // 捷運預設出發／抵達站先給同一個系統：不同系統大多沒有互通，用 keys[1] 當預設抵達站
    // 系統的話，一切換到捷運模式就直接出現一組選不出合理路線的組合。
    const dCity = key === "metro" ? oCity : keys[1] ?? keys[0];
    setOriginCity(oCity);
    setOrigin(cities[oCity][0]);
    setDestCity(dCity);
    setDest(cities[dCity][dCity === oCity && cities[dCity].length > 1 ? 1 : 0]);
  }
  // 火車模式下，出發／抵達站只要變動就存起來，下次切回火車模式會自動還原，不用另外在
  // 編輯彈窗裡設「預設站牌」。日期／時間都故意不存——永遠先用現在的日期、時間頂著，
  // 使用者想要別的自己調（見 selectMode 裡的說明）。
  useEffect(() => {
    if (mode !== "train") return;
    saveTrainSearch({ originCity, origin, destCity, dest });
  }, [mode, originCity, origin, destCity, dest]);
  // 捷運／高鐵出發／抵達站只要變動就存起來，下次切回同一個車種會自動還原，不用每次都
  // 重新選一次系統／站點。
  useEffect(() => {
    if (mode !== "metro" && mode !== "thsr") return;
    saveStationOnlySearch(mode === "metro" ? METRO_SEARCH_KEY : THSR_SEARCH_KEY, { originCity, origin, destCity, dest });
  }, [mode, originCity, origin, destCity, dest]);
  function swapStations() {
    setOriginCity(destCity);
    setOrigin(dest);
    setDestCity(originCity);
    setDest(origin);
  }
  function searchTrains() {
    // 日期欄位的初始值只在掛載那一刻算一次（useState(todayLocal)），分頁開著跨過半夜
    // 沒有重新整理的話，日期會一直卡在「昨天」，拿去查台鐵／高鐵的每日時刻表會直接被
    // TDX 擋掉（只收今天或未來的日期，查過去會 400）。搜尋當下如果發現日期已經過去，
    // 自動跳回今天，不用使用者自己發現、手動重選。
    const searchDate = date < todayLocal() ? todayLocal() : date;
    if (searchDate !== date) setDate(searchDate);
    // 公車是路線＋方向＋站牌（不是起訖站），結果頁要帶這三個參數加縣市，不是 origin/dest。
    if (mode === "bus") {
      if (!busSelection) return;
      const qs = new URLSearchParams({
        mode,
        busCity: busSelection.cityName,
        busRoute: busSelection.routeName,
        busDirection: String(busSelection.direction),
        busStop: busSelection.stopName,
        from: "home",
      });
      router.push(`/tools/transit/results?${qs.toString()}`);
      return;
    }
    router.push(
      `/tools/transit/results?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&mode=${mode}&date=${searchDate}&time=${encodeURIComponent(time)}&from=home`,
    );
  }
  return (
    <div className="-mb-24 flex min-h-full flex-col bg-white pb-24">
      {(() => {
        // 跟 todayWeekendTrip 同一套：還沒在「其他」頁設定過（heroBanners 是空陣列）就退回
        // 原本寫死的那組文案＋圖片，連同原本固定 2 行的排版（<br/> 強制斷行）一起保留；
        // 使用者自己設定的文案不知道長度，改成不強制斷行的單行文字，讓它自然換行。
        const todayHeroBanner = heroBannerIndex !== null ? heroBanners[heroBannerIndex] : null;
        return (
          <div className="relative h-80 w-full shrink-0 overflow-hidden">
            {/* src 要等 heroReady 才給值：一開始就先放預設圖，等資料回來發現抽到別組又要
                換一張，使用者會看到背景圖先顯示預設圖、閃一下才換成抽到的那張。沒有 src
                的這段時間 ImageSlot 會顯示漸層佔位，資料回來後只會載入一次最終真的要顯示
                的那張圖，不會先載一張錯的。 */}
            <ImageSlot
              src={heroReady ? (todayHeroBanner?.image ?? ICON_PATHS.heroMain) : undefined}
              alt={todayHeroBanner?.title ?? "夢幻紫彩火車旅行插畫"}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
            {/* 跟著首頁內容一起捲動，不是外殼層級的 fixed／absolute 覆蓋層，滑動時不會貼著螢幕
                右上角不動。 */}
            <button
              type="button"
              onClick={openSettings}
              aria-label="編輯首頁設定"
              className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-full border border-[#ECE4FA] bg-white/80 text-[#6F5FD6] shadow-sm backdrop-blur"
            >
              <FaIcon icon="pen" size={14} />
            </button>
            {/* 底圖現在是真的插畫照片，不是單純漸層，文字沒有夠深的陰影很容易被底圖的淺色
                區域吃掉；drop-shadow-sm 太淡，改用自己調的 text-shadow 加深。 */}
            <div className="absolute left-5 top-6 right-5 text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)" }}>
              {!heroReady ? (
                // fetch 還沒回來，先用骨架佔著位置，不要讓使用者先看到寫死的預設文案、
                // fetch 回來後又突然跳成抽到的那組——避免文字內容中途變來變去。
                <div className="animate-pulse">
                  <div className="h-7 w-3/4 rounded-full bg-white/30" />
                  <div className="mt-3 h-4 w-1/2 rounded-full bg-white/20" />
                </div>
              ) : todayHeroBanner ? (
                <>
                  <p className="text-2xl font-bold leading-snug">{todayHeroBanner.title}</p>
                  <p className="mt-2 text-sm opacity-90">{todayHeroBanner.caption}</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold leading-snug">下一站，去看更大的世界</p>
                  <p className="mt-2 text-sm opacity-90">一段旅程，都是生活的延伸</p>
                </>
              )}
            </div>
          </div>
        );
      })()}
      <div className="relative z-10 -mt-16 flex-1 rounded-t-[2rem] bg-white px-5 pb-6 pt-5 shadow-[0_-8px_24px_-8px_rgba(111,95,214,0.2)]">
        <div className="mb-2">
          {weatherReady ? <WeatherCarousel blocks={weatherBlocks} /> : <WeatherCarouselSkeleton />}
        </div>
        <div className="flex items-center gap-2">
          {MODES.map((m) => {
            // modeReady 前不顯示任何 active 背景；
            // 確認使用者最後停留的車種後，才只替該按鈕加上 bg-[#EFEAFC]。
            const active = modeReady && mode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => selectMode(m.key)}
                className={`flex h-[80px] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-xs transition-colors ${active ? "bg-[#EFEAFC] font-semibold text-[#6F5FD6]" : "text-[#9C94C4]"
                  }`}
              >
                <ImageSlot src={m.icon} alt={`${m.label}圖示`} className="size-10 rounded-lg" />
                {m.label}
              </button>
            );
          })}
        </div>
        {mode === "bus" ? (
          <div className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">公車路線／站牌</span>
              <button type="button" onClick={() => setBusPickerOpen(true)} className="grid grid-cols-2 gap-2 text-left">
                <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                  {busSelection ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${routeBadgeStyle(busSelection.routeName)}`}>
                      {busSelection.routeName}
                    </span>
                  ) : (
                    <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">選擇路線</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                  <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{busSelection?.stopName ?? "選擇站牌"}</span>
                </div>
              </button>
            </label>
          </div>
        ) : (
          <div className="relative mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">出發{stationLabel}</span>
              <button type="button" onClick={() => setOriginPickerOpen(true)} className="grid grid-cols-2 gap-2 text-left">
                <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
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
                  <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{safeDestCity}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                  <span className="flex-1 truncate text-sm font-medium text-[#4A3B7C]">{dest}</span>
                </div>
              </button>
            </label>
          </div>
        )}
        <BusRoutePickerModal
          key={busPickerOpen ? "bus-open" : "bus-closed"}
          open={busPickerOpen}
          initial={busSelection ?? undefined}
          onClose={() => setBusPickerOpen(false)}
          onSave={(selection) => setBusSelection(selection)}
        />
        {mode !== "bus" && (
          <>
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
                // 換了出發站的系統，原本選的抵達站如果在新的出發系統底下已經不能選（不同系統
                // 又沒有互通），抵達站要跟著重設，不然會卡著一組已經不合法的出發／抵達組合。
                const nextDestCities = destCitiesFor(mode, city, citiesForMode);
                if (!nextDestCities[destCity]) {
                  const firstCity = Object.keys(nextDestCities)[0];
                  setDestCity(firstCity);
                  setDest(nextDestCities[firstCity][0]);
                }
                setOriginPickerOpen(false);
              }}
            />
            <StationPickerModal
              key={destPickerOpen ? "dest-open" : "dest-closed"}
              open={destPickerOpen}
              title={`選擇抵達${stationLabel}`}
              cities={destCitiesForMode}
              initialCity={safeDestCity}
              initialStation={dest}
              onClose={() => setDestPickerOpen(false)}
              onSave={(city, station) => {
                setDestCity(city);
                setDest(station);
                setDestPickerOpen(false);
              }}
            />
          </>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[#9C94C4]">日期</span>
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left text-sm text-[#4A3B7C]"
            >
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
          disabled={mode === "bus" && !busSelection}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)] disabled:opacity-50"
          style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
        >
          <FaIcon icon="magnifying-glass" size={14} className="text-white" /> {mode === "bus"
            ? "查詢即時到站"
            : `搜尋${MODES.find((m) => m.key === mode)?.label}班次`} <span aria-hidden>→</span>
        </button>
        <p className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
          <span aria-hidden className="text-[#C9A6F2]">
            ♦
          </span>
          小小備忘錄
          <button type="button" onClick={() => setMemoEditorOpen(true)} aria-label="編輯備忘錄" className="ml-auto">
            <FaIcon icon="pen" size={14} />
          </button>
        </p>
        {!memosReady ? (
          memosSkeletonCount === 0 ? (
            <p className="mt-2 text-xs text-[#B3ABD4]">載入中…</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2.5">
              {Array.from({ length: memosSkeletonCount }, (_, i) => (
                <div key={i} className="rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
                  <ListRowSkeleton iconSize={48} />
                </div>
              ))}
            </div>
          )
        ) : memos.length === 0 ? (
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
        {/* 使用者在「其他」頁設定過幾組標題＋文案＋背景圖的話，每次進頁面／重新整理隨機挑
            一組（見掛載時那個 effect）；還沒設定過（weekendTrips 是空陣列）就退回原本寫死
            的那組，不影響舊有畫面。 */}
        {(() => {
          const todayWeekendTrip = weekendTripIndex !== null ? weekendTrips[weekendTripIndex] : null;
          return (
            <div className="relative mt-6 h-28 overflow-hidden rounded-2xl">
              {/* 整個卡片背景換成真圖，不是右邊一個小圖示；圖還沒上傳前 ImageSlot 會自動退回
                  漸層佔位，所以這裡不用再額外寫死一層漸層背景。src 要等 weekendReady 才給
                  值，理由跟上面首頁主視覺那段一樣：避免先顯示預設圖、資料回來才又換成抽到
                  的那張，使用者會看到背景圖切換的瞬間。 */}
              <ImageSlot
                src={weekendReady ? (todayWeekendTrip?.image ?? ICON_PATHS.weekendTripBanner) : undefined}
                alt={todayWeekendTrip?.title ?? "週末小旅行"}
                className="absolute inset-0 h-full w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />
              <div className="relative z-10 flex h-full items-center px-5 py-4">
                {!weekendReady ? (
                  // 跟首頁最上方 Banner 同一套：fetch 回來前先用骨架佔位，不要先看到寫死的
                  // 預設文案才又跳成抽到的那組。
                  <div className="w-2/3 animate-pulse">
                    <div className="h-4 w-full rounded-full bg-white/30" />
                    <div className="mt-2 h-3 w-4/5 rounded-full bg-white/20" />
                  </div>
                ) : (
                  <div style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)" }}>
                    <p className="text-base font-bold text-white">{todayWeekendTrip?.title ?? "週末小旅行"}</p>
                    <p className="mt-0.5 text-xs text-white/85">{todayWeekendTrip?.caption ?? "找尋屬於自己的風景"}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
        initial={{ weatherBlocks }}
        onClose={closeSettings}
        onSave={saveSettings}
      />
    </div>
  );
}