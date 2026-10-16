"use client";

import { useEffect, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { BUS_CITIES } from "./bus-cities";
import { NearbyButton } from "./nearby-button";
import { formatDistance } from "@/lib/geo";
import type { BusEtaStatus } from "@/lib/transit/bus-routing";
import { Badge, Field, FieldRow, LinkButton, ListMessage, ScrollList, ScrollListRow, SegmentedTabs, SelectButton, TextInput } from "./ui";
import { copy, text } from "./theme";
import { ScrollRowsSkeleton } from "./skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "./skeleton-count";

export interface BusRouteSelection {
  cityName: string;
  routeName: string;
  /** 0＝去程、1＝返程，跟 TDX StopOfRoute 的 Direction 欄位同一套編號。 */
  direction: 0 | 1;
  stopName: string;
}

interface BusStopEta {
  name: string;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

interface StopRouteEta {
  routeName: string;
  direction: 0 | 1;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

interface NearbyBusStop {
  stopUID: string;
  name: string;
  cityName: string;
  distanceMeters: number;
}

// 附近站牌顯示的筆數上限，跟 Ubike 附近站點同一個邏輯：定位一次之後附近的站牌就夠用，
// 不用把全部縣市排序完的清單都塞進畫面。排序、裁切都在伺服器端做完（見
// app/api/transit/bus/nearby-stops），這裡只是告訴它要幾筆。
const NEARBY_LIMIT = 20;

// 骨架列數記憶的 key。設計系統規定骨架數量要跟載入完的實際數量一致，所以「筆數可以預測」
// 的清單（某條路線的站序、某個站牌有哪些路線、附近站牌）都記住上次的實際筆數；
// 「搜尋結果」的筆數隨關鍵字變動、根本猜不到，那種就不畫骨架，顯示「搜尋中…」。
const routeStopsCountKey = (city: string, route: string, direction: 0 | 1) =>
  `cpx-tools:transit:bus-route-stops-count:${city}|${route}|${direction}`;
const stopRoutesCountKey = (city: string, stop: string, direction: 0 | 1) =>
  `cpx-tools:transit:bus-stop-routes-count:${city}|${stop}|${direction}`;
const NEARBY_COUNT_KEY = "cpx-tools:transit:bus-nearby-count";

// 文字說明照 lib/bus-routing.ts 的分類：ok 才有倒數分鐘可以顯示，其他狀態只顯示文字。
const STATUS_LABEL: Record<BusEtaStatus, string> = {
  ok: "",
  arriving: "進站中",
  notStarted: "未發車",
  pastLast: "末班已過",
  unavailable: "無資料",
};

export function etaLabel(eta: { status: BusEtaStatus; etaMinutes: number | null }): string {
  return eta.status === "ok" && eta.etaMinutes !== null ? `${eta.etaMinutes} 分` : STATUS_LABEL[eta.status];
}

// ok 底下再依「快到了沒」分橘／綠兩種色調，是畫面上額外的呈現判斷（3 分鐘內比較搶眼），
// 不是 TDX 另外給的分類。
export function etaToneStyle(eta: { status: BusEtaStatus; etaMinutes: number | null }): string {
  if (eta.status === "ok") {
    return eta.etaMinutes !== null && eta.etaMinutes <= 3 ? "bg-[#FDE7D8] text-[#D97A3D]" : "bg-[#E3F6EC] text-[#2FAE82]";
  }
  if (eta.status === "arriving") return "bg-[#FDEEF0] text-[#D1517E]";
  return "bg-[#F3EFFC] text-[#B3ABD4]";
}

// 路線色塊：淺底＋飽和字，沿用專案已經在用的色票（公車路線徽章綠色、捷運線色標籤同一套
// 視覺語言）；棕／橘／黃／F／小／幹線目前沒有現成色票，新配但維持同一套風格。用路線
// 名稱「開頭那個字」對應色塊，查不到就退回中性灰。
const ROUTE_COLOR_PREFIX_STYLE: Record<string, string> = {
  紅: "bg-[#FDEEF0] text-[#D1517E]",
  藍: "bg-[#E6EEFC] text-[#4E7FE0]",
  綠: "bg-[#E3F6EC] text-[#2FAE82]",
  棕: "bg-[#F5EDE4] text-[#9C6B3E]",
  橘: "bg-[#FDE7D8] text-[#D97A3D]",
  黃: "bg-[#FEF6D8] text-[#C9971F]",
  F: "bg-[#E8F7F3] text-[#2BA38A]",
  小: "bg-[#F3EFFC] text-[#6F5FD6]",
  幹: "bg-[#EDEAFC] text-[#8477C2]",
};

export function routeBadgeStyle(routeName: string): string {
  const prefix = routeName.match(/^(紅|藍|綠|棕|橘|黃|F|小|幹)/)?.[1];
  return (prefix && ROUTE_COLOR_PREFIX_STYLE[prefix]) || "bg-[#E3F6EC] text-[#2FAE82]";
}

// 自訂數字／色塊鍵盤，不用瀏覽器原生的文字鍵盤——路線編號常常是「數字＋顏色字」組合
// （例如「紅29」），色塊鍵直接插入對應的字，比切輸入法打字快很多。
//
// 快速鍵依縣市不同：直接拿 TDX 真實路線資料逐一驗證過每個縣市的命名習慣（不是憑印象
// 配色）——台北／新北市真的是「顏色＋數字」這種組合（約 2~4 成路線是這樣命名）；桃園市
// 的顏色字是「紅線／黃線／綠線」整條線名稱，不是前綴，另外 F 開頭的路線也不少；基隆市
// 85 條路線完全沒有顏色開頭的，色塊鍵對它來說全部是廢的，所以乾脆不給，只留數字鍵。
type KeypadKey = { label: string; insert: string; tone?: keyof typeof ROUTE_COLOR_PREFIX_STYLE };

const DIGIT_KEYS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => ({ label: d, insert: d }));
const BACKSPACE_KEY: KeypadKey = { label: "⌫", insert: "" };

const KEYPAD_BY_CITY: Record<string, KeypadKey[]> = {
  台北市: [
    { label: "紅", insert: "紅", tone: "紅" },
    { label: "藍", insert: "藍", tone: "藍" },
    { label: "綠", insert: "綠", tone: "綠" },
    { label: "棕", insert: "棕", tone: "棕" },
    { label: "橘", insert: "橘", tone: "橘" },
    { label: "黃", insert: "黃", tone: "黃" },
    { label: "F", insert: "F", tone: "F" },
    { label: "小", insert: "小", tone: "小" },
    { label: "幹線", insert: "幹線", tone: "幹" },
  ],
  新北市: [
    { label: "紅", insert: "紅", tone: "紅" },
    { label: "藍", insert: "藍", tone: "藍" },
    { label: "綠", insert: "綠", tone: "綠" },
    { label: "棕", insert: "棕", tone: "棕" },
    { label: "橘", insert: "橘", tone: "橘" },
    { label: "黃", insert: "黃", tone: "黃" },
    { label: "F", insert: "F", tone: "F" },
    { label: "小", insert: "小", tone: "小" },
    { label: "幹線", insert: "幹線", tone: "幹" },
  ],
  桃園市: [
    { label: "F", insert: "F", tone: "F" },
    { label: "紅線", insert: "紅線", tone: "紅" },
    { label: "黃線", insert: "黃線", tone: "黃" },
    { label: "綠線", insert: "綠線", tone: "綠" },
  ],
  基隆市: [],
  // 新竹市：有「藍線」「綠線1區」這種整條線名稱（跟桃園一樣是線名不是前綴），也有
  // 「11甲」這種數字＋甲的組合；藍／綠套用現成色票，甲／線沒有對應顏色，用預設灰底。
  新竹市: [
    { label: "藍", insert: "藍", tone: "藍" },
    { label: "綠", insert: "綠", tone: "綠" },
    { label: "甲", insert: "甲" },
    { label: "線", insert: "線" },
  ],
  // 新竹縣：路線名稱很雜（4 位數代碼、「路」後綴、純文字命名都有），沒有明顯能歸納成
  // 幾顆按鍵的規律，給純數字鍵盤就好，複雜的名稱交給搜尋框打字或之後的文字路線清單。
  新竹縣: [],
  // 台中市：「105延」「14副」「152區1」這種數字＋後綴字很常見，三顆後綴字沒有對應顏色。
  台中市: [
    { label: "延", insert: "延" },
    { label: "副", insert: "副" },
    { label: "區", insert: "區" },
  ],
  // 彰化縣：目前查到的路線資料很少（17 條），大多是「N路」這種簡單數字命名，純數字鍵盤
  // 就夠用，不特別加「路」鍵。
  彰化縣: [],
  // 台南市：「紅1」~「紅15」真的存在，沿用紅色鍵；「0左」「0右」是方向後綴。
  台南市: [
    { label: "紅", insert: "紅", tone: "紅" },
    { label: "左", insert: "左" },
    { label: "右", insert: "右" },
  ],
  // 高雄市：「16A」「217D」這種數字＋英文字母後綴很常見，字母沒有對應顏色。
  高雄市: [
    { label: "A", insert: "A" },
    { label: "B", insert: "B" },
    { label: "D", insert: "D" },
    { label: "E", insert: "E" },
  ],
};

/** 查不到對應縣市的快速鍵清單時退回空陣列（純數字鍵盤），不會整個壞掉。 */
function keypadForCity(city: string): KeypadKey[] {
  return [...DIGIT_KEYS, ...(KEYPAD_BY_CITY[city] ?? []), BACKSPACE_KEY];
}

// 路線查詢框的提示範例也依縣市換，不然基隆市這種沒有顏色字的縣市，看到「例如紅29」反而
// 誤導使用者去按根本不存在的紅色鍵。
const ROUTE_QUERY_EXAMPLE_BY_CITY: Record<string, string> = {
  台北市: "紅29",
  新北市: "紅29",
  桃園市: "F901",
  基隆市: "105",
  新竹市: "11甲",
  新竹縣: "106",
  台中市: "105延",
  彰化縣: "10",
  台南市: "紅1",
  高雄市: "16A",
};

// 彈窗用 key={...} 強制每次開關整個 remount（見 home-view.tsx），元件內的 useState 不會
// 留著——這幾個快取放在元件外面（模組層級），關掉再打開同一個 city/路線/站牌不用重打 API，
// 直到分頁關掉才會消失。路線／站牌「名稱」清單幾乎不會變，快取久一點；查詢結果裡帶即時到站
// 時間的（路線詳情、站牌詳情）要新鮮一點，比照伺服器端 ETA 快取的新鮮度（60 秒）抓短一點。
const SEARCH_CACHE_TTL_MS = 5 * 60_000;
const ETA_CACHE_TTL_MS = 30_000;

interface ClientCacheEntry<T> {
  data: T;
  expiresAt: number;
}

function getCached<T>(cache: Map<string, ClientCacheEntry<T>>, key: string): T | undefined {
  const hit = cache.get(key);
  return hit && hit.expiresAt > Date.now() ? hit.data : undefined;
}

function setCached<T>(cache: Map<string, ClientCacheEntry<T>>, key: string, data: T, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const routeSearchCache = new Map<string, ClientCacheEntry<string[]>>();
const stopSearchCache = new Map<string, ClientCacheEntry<string[]>>();
const routeStopsCache = new Map<string, ClientCacheEntry<Record<0 | 1, BusStopEta[]>>>();
const stopRoutesCache = new Map<string, ClientCacheEntry<StopRouteEta[]>>();

type Step = { kind: "search" } | { kind: "routeDetail"; routeName: string } | { kind: "stopDetail"; stopName: string };

const DIRECTION_TABS = [
  { key: "0" as const, label: "去程" },
  { key: "1" as const, label: "返程" },
];

// 路線詳情、站牌詳情兩個 step 都需要「去程／返程切換 tabs」＋「重新搜尋」並排在同一行，
// 重新搜尋固定靠右——抽成共用小元件，不要兩處各寫一份幾乎一樣的 JSX。
function DirectionTabsRow({
  direction,
  onChangeDirection,
  onBack,
}: {
  direction: 0 | 1;
  onChangeDirection: (d: 0 | 1) => void;
  onBack: () => void;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <SegmentedTabs
        items={DIRECTION_TABS}
        value={direction === 1 ? "1" : "0"}
        onChange={(key) => onChangeDirection(key === "1" ? 1 : 0)}
      />
      <LinkButton onClick={onBack}>‹ 重新搜尋</LinkButton>
    </div>
  );
}

const SEARCH_MODE_TABS = [
  { key: "stop" as const, label: "站牌" },
  { key: "route" as const, label: "路線" },
];

export function BusRoutePickerModal({
  open,
  initial,
  openNearby,
  onClose,
  onSave,
  onCityChange,
}: {
  open: boolean;
  initial?: Partial<BusRouteSelection>;
  /** 從首頁「附近站牌」捷徑進來時，彈窗一開就直接停在附近分頁並立刻觸發定位，不用
      使用者自己先開彈窗、再點一次附近站牌。 */
  openNearby?: boolean;
  onClose: () => void;
  onSave: (selection: BusRouteSelection) => void;
  /** 選了縣市那一刻就通知首頁——縣市不用等整個選完（路線＋站牌）才回填，彈窗後面的
      首頁縣市欄位要能馬上同步看到剛選的縣市，不然選完縣市使用者會覺得畫面後面沒反應。 */
  onCityChange?: (city: string) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [searchMode, setSearchMode] = useState<"route" | "stop" | "nearby">(openNearby ? "nearby" : "stop");
  const [query, setQuery] = useState("");
  const [cityName, setCityName] = useState(initial?.cityName && BUS_CITIES.includes(initial.cityName) ? initial.cityName : BUS_CITIES[0]);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [direction, setDirection] = useState<0 | 1>(initial?.direction ?? 0);

  const [routeResults, setRouteResults] = useState<string[]>([]);
  const [stopResults, setStopResults] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 附近站牌：不熟悉的地方不知道站名也不知道路線編號，靠 GPS 直接找最近的真實站牌——
  // 跟 Ubike 附近站點同一套做法。定位會改變畫面顯示的資料，所以不在切到這個分頁時自動
  // 要求權限，要使用者自己點按鈕才觸發，瀏覽器的定位權限彈窗跳出來時才不會讓人覺得莫名其妙。
  const [locating, setLocating] = useState(false);
  const [nearbyCoords, setNearbyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStops, setNearbyStops] = useState<NearbyBusStop[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbySkeletonCount, setNearbySkeletonCount] = useState(0);

  function requestNearby() {
    if (!navigator.geolocation) {
      setNearbyError("這個瀏覽器不支援定位功能");
      return;
    }
    setLocating(true);
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNearbyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setNearbyError(err.code === err.PERMISSION_DENIED ? "請到瀏覽器設定開啟定位權限" : "定位失敗，請稍後再試");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function cancelNearby() {
    setNearbyCoords(null);
    setNearbyStops(null);
    setNearbyError(null);
  }

  // 從首頁「附近站牌」捷徑進來時，searchMode 初始值已經是 "nearby"，這裡只差「定位」
  // 這個動作本身要自動觸發——彈窗本來就是使用者主動點「附近站牌」按鈕才打開的，不是
  // 莫名其妙跳出來，所以這個情境不違反「要使用者自己點按鈕才定位」那個理由。彈窗用
  // key remount，這個效果只會在每次新開的彈窗實例上跑一次。
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (openNearby) requestNearby();
    setNearbySkeletonCount(loadSkeletonCount(NEARBY_COUNT_KEY, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拿到座標後交給伺服器查——縣市粗篩（使用者可能剛好在兩個縣市交界，只查單一縣市會漏掉
  // 其實比較近的另一邊站牌）、合併去重、依距離排序、裁到前 NEARBY_LIMIT 筆全部在伺服器
  // 端做完（見 app/api/transit/bus/nearby-stops）。以前是前端對 10 個縣市各發一次請求、
  // 把整包站牌座標拉回瀏覽器才開始算距離，TDX 的額度（每分鐘 5 次）根本撐不住。
  useEffect(() => {
    if (!nearbyCoords) return;
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNearbyStops(null);
    const qs = new URLSearchParams({ lat: String(nearbyCoords.lat), lng: String(nearbyCoords.lng), limit: String(NEARBY_LIMIT) });
    fetch(`/api/transit/bus/nearby-stops?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stops?: NearbyBusStop[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setNearbyError(data.error);
          setNearbyStops([]);
          return;
        }
        const stops = data.stops ?? [];
        setNearbyStops(stops);
        saveSkeletonCount(NEARBY_COUNT_KEY, stops.length);
      })
      .catch(() => {
        if (cancelled) return;
        setNearbyError(copy.failed("附近站牌"));
        setNearbyStops([]);
      });
    return () => {
      cancelled = true;
    };
  }, [nearbyCoords]);

  // 純文字命名的路線（例如「東山咖啡線」）名稱裡沒有數字，縣市快速鍵／數字鍵盤完全打不出
  // 這幾個字，查詢框也查不到——改用瀏覽的方式選，點開才查（不是一進彈窗就打，省一次
  // 不一定用得到的請求），查回來的清單通常很短，不用像一般搜尋結果那樣裁 30 筆。
  const [namedRoutesOpen, setNamedRoutesOpen] = useState(false);
  const [namedRoutes, setNamedRoutes] = useState<string[] | null>(null);
  const [namedRoutesError, setNamedRoutesError] = useState<string | null>(null);

  useEffect(() => {
    if (!namedRoutesOpen) return;
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNamedRoutes(null);
    setNamedRoutesError(null);
    fetch(`/api/transit/bus/named-routes?city=${encodeURIComponent(cityName)}`)
      .then((res) => res.json())
      .then((data: { routes?: string[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setNamedRoutesError(data.error);
          return;
        }
        setNamedRoutes(data.routes ?? []);
      })
      .catch(() => {
        if (!cancelled) setNamedRoutesError(copy.queryFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [namedRoutesOpen, cityName]);

  // 搜尋路線／站牌：依目前選的縣市＋輸入字即時查真實 TDX 資料，不是前端自己過濾假清單。
  // 小鍵盤／文字框每打一個字就會變動查詢字，debounce 200ms 再查，不用每個按鍵都打一次。
  // 還沒輸入任何字就不查——彈窗一打開 query 是空字串，不應該平白無故先打一次 API。
  useEffect(() => {
    if (step.kind !== "search" || searchMode === "nearby") return;

    const trimmed = query.trim();
    const cache = searchMode === "route" ? routeSearchCache : stopSearchCache;

    if (!trimmed) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSearchLoading(false);
      setSearchError(null);
      if (searchMode === "route") setRouteResults([]);
      else setStopResults([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    const cacheKey = `${cityName}|${trimmed}`;
    const cached = getCached(cache, cacheKey);
    if (cached) {
      setSearchLoading(false);
      setSearchError(null);
      if (searchMode === "route") setRouteResults(cached);
      else setStopResults(cached);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      const endpoint = searchMode === "route" ? "routes" : "stops";
      const qs = new URLSearchParams({ city: cityName, q: trimmed });
      fetch(`/api/transit/bus/${endpoint}?${qs.toString()}`)
        .then((res) => res.json())
        .then((data: { routes?: string[]; stops?: string[]; error?: string }) => {
          if (cancelled) return;
          if (data.error) {
            setSearchError(data.error);
            return;
          }
          const results = (searchMode === "route" ? data.routes : data.stops) ?? [];
          setCached(cache, cacheKey, results, SEARCH_CACHE_TTL_MS);
          if (searchMode === "route") setRouteResults(results);
          else setStopResults(results);
        })
        .catch(() => {
          if (!cancelled) setSearchError(copy.queryFailed);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step.kind, searchMode, query, cityName]);

  const routeNameForDetail = step.kind === "routeDetail" ? step.routeName : null;
  const [routeStopsByDirection, setRouteStopsByDirection] = useState<Record<0 | 1, BusStopEta[]> | null>(null);
  const [routeStopsError, setRouteStopsError] = useState<string | null>(null);

  // 路線詳情：去程、返程的真實站序一次抓回來存同一個快取 key，切換方向純粹換畫面，
  // 不用再打一次 API（跟下面站牌詳情的 stopRoutes 是同一套做法）。
  useEffect(() => {
    if (!routeNameForDetail) return;

    const cacheKey = `${cityName}|${routeNameForDetail}`;
    const cached = getCached(routeStopsCache, cacheKey);
    if (cached) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRouteStopsByDirection(cached);
      setRouteStopsError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;
    setRouteStopsByDirection(null);
    setRouteStopsError(null);
    const qs = new URLSearchParams({ city: cityName, route: routeNameForDetail });
    fetch(`/api/transit/bus/route-stops?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stops?: Record<0 | 1, BusStopEta[]>; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setRouteStopsError(data.error);
          return;
        }
        const stops = data.stops ?? { 0: [], 1: [] };
        setCached(routeStopsCache, cacheKey, stops, ETA_CACHE_TTL_MS);
        setRouteStopsByDirection(stops);
        // 兩個方向的實際站數都記起來，下次看同一條路線的骨架列數就跟真的一樣。
        saveSkeletonCount(routeStopsCountKey(cityName, routeNameForDetail, 0), stops[0].length);
        saveSkeletonCount(routeStopsCountKey(cityName, routeNameForDetail, 1), stops[1].length);
      })
      .catch(() => {
        if (!cancelled) setRouteStopsError(copy.failed("公車站序"));
      });
    return () => {
      cancelled = true;
    };
  }, [routeNameForDetail, cityName]);

  const routeStopsForDirection = routeStopsByDirection ? routeStopsByDirection[direction] : null;

  const stopNameForDetail = step.kind === "stopDetail" ? step.stopName : null;
  const [stopRoutes, setStopRoutes] = useState<StopRouteEta[] | null>(null);
  const [stopRoutesError, setStopRoutesError] = useState<string | null>(null);

  // 站牌詳情：目前有停靠這個站牌的所有路線（去程／返程分開），各自帶即時到站狀態。
  useEffect(() => {
    if (!stopNameForDetail) return;

    const cacheKey = `${cityName}|${stopNameForDetail}`;
    const cached = getCached(stopRoutesCache, cacheKey);
    if (cached) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setStopRoutes(cached);
      setStopRoutesError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;
    setStopRoutes(null);
    setStopRoutesError(null);
    const qs = new URLSearchParams({ city: cityName, stop: stopNameForDetail });
    fetch(`/api/transit/bus/stop-routes?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { routes?: StopRouteEta[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setStopRoutesError(data.error);
          return;
        }
        const routes = data.routes ?? [];
        setCached(stopRoutesCache, cacheKey, routes, ETA_CACHE_TTL_MS);
        setStopRoutes(routes);
        saveSkeletonCount(stopRoutesCountKey(cityName, stopNameForDetail, 0), routes.filter((r) => r.direction === 0).length);
        saveSkeletonCount(stopRoutesCountKey(cityName, stopNameForDetail, 1), routes.filter((r) => r.direction === 1).length);
      })
      .catch(() => {
        if (!cancelled) setStopRoutesError(copy.failed("公車站牌"));
      });
    return () => {
      cancelled = true;
    };
  }, [stopNameForDetail, cityName]);

  // 站牌詳情也要能用去程／返程 tabs 切換：查回來的清單本來就每筆各自帶真實方向，這裡只是
  // 依目前選的方向過濾顯示，不用另外多打一次 API。
  const stopRoutesForDirection = (stopRoutes ?? []).filter((r) => r.direction === direction);

  // 詳情清單（路線站序／站牌有哪些路線）載入中要畫幾列骨架——localStorage 只有瀏覽器端
  // 讀得到，所以在 effect 裡讀、不在 render 當下讀；換路線／換站牌／換方向都要重新算。
  const [detailSkeletonCount, setDetailSkeletonCount] = useState(0);
  useEffect(() => {
    const key =
      step.kind === "routeDetail"
        ? routeStopsCountKey(cityName, step.routeName, direction)
        : step.kind === "stopDetail"
          ? stopRoutesCountKey(cityName, step.stopName, direction)
          : null;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setDetailSkeletonCount(key ? loadSkeletonCount(key, 0) : 0);
  }, [step, cityName, direction]);

  if (!open) return null;

  function close() {
    setStep({ kind: "search" });
    setSearchMode("stop");
    setQuery("");
    setDirection(0);
    setNearbyCoords(null);
    setNearbyStops(null);
    setNearbyError(null);
    onClose();
  }

  function pickFromRouteDetail(routeName: string, stopName: string) {
    onSave({ cityName, routeName, direction, stopName });
    close();
  }

  function pickFromStopDetail(routeName: string, routeDirection: 0 | 1, stopName: string) {
    onSave({ cityName, routeName, direction: routeDirection, stopName });
    close();
  }

  // 附近站牌點了之後，直接沿用現有的「站牌詳情」畫面（去程／返程 tabs、這個站有哪些
  // 路線經過＋即時到站）——不用另外刻一套，只是站牌可能來自跟目前選的 cityName 不同的
  // 縣市，要先把 cityName 切過去，後面站牌詳情的查詢才會打對縣市。
  function pickNearbyStop(stop: NearbyBusStop) {
    setCityName(stop.cityName);
    onCityChange?.(stop.cityName);
    setStep({ kind: "stopDetail", stopName: stop.name });
  }

  function pickNamedRoute(routeName: string) {
    setNamedRoutesOpen(false);
    setStep({ kind: "routeDetail", routeName });
  }

  const title = step.kind === "search" ? "選擇公車路線或站牌" : step.kind === "routeDetail" ? step.routeName : step.kind === "stopDetail" ? step.stopName : "";

  return (
    <>
      <BottomSheetModal
        open={open}
        title={title}
        onClose={close}
        bodyClassName={step.kind === "search" ? "flex flex-col gap-3 px-5 py-5" : "flex flex-col gap-2 px-5 py-5"}
      >
        {step.kind === "search" && (
          <>
            <div className="flex items-center justify-between gap-2">
              <SegmentedTabs
                items={SEARCH_MODE_TABS}
                value={searchMode === "route" ? "route" : "stop"}
                onChange={(m) => {
                  setSearchMode(m);
                  setQuery("");
                }}
                ready={searchMode !== "nearby"}
              />

              {/* 不熟悉的地方不知道站名也不知道路線編號——跟站牌／路線切換並排的獨立按鈕，
                  點了直接定位＋查詢，不用先切到一個分頁再按一次才開始定位。跟 Ubike 附近
                  站點共用同一個按鈕元件（見 nearby-button.tsx），間距、字體統一。 */}
              <NearbyButton
                active={searchMode === "nearby"}
                locating={locating}
                label="附近站牌"
                onClick={() => {
                  if (searchMode === "nearby") {
                    setSearchMode("stop");
                    cancelNearby();
                  } else {
                    setSearchMode("nearby");
                    setQuery("");
                    requestNearby();
                  }
                }}
              />
            </div>

            {searchMode === "nearby" ? (
              <>
                {nearbyError && <p className={`text-center ${text.error}`}>{nearbyError}</p>}
                {!nearbyError && (
                  <ScrollList className="max-h-72">
                    {!nearbyCoords ? (
                      <ListMessage>{copy.locating}</ListMessage>
                    ) : nearbyStops === null ? (
                      // 附近站牌的筆數很固定（伺服器端就是回傳前 20 筆），骨架列數照上次
                      // 實際筆數猜，不要用一段文字頂著——那樣清單出現時高度會整塊跳。
                      nearbySkeletonCount === 0 ? (
                        <ListMessage>{copy.searching}</ListMessage>
                      ) : (
                        <ScrollRowsSkeleton count={nearbySkeletonCount} />
                      )
                    ) : nearbyStops.length === 0 ? (
                      <ListMessage>附近沒有查到站牌</ListMessage>
                    ) : (
                      nearbyStops.map((s) => (
                        <ScrollListRow key={s.stopUID} onClick={() => pickNearbyStop(s)}>
                          <span className={`min-w-0 flex-1 truncate ${text.bodyStrong}`}>{s.name}</span>
                          <span className={`shrink-0 ${text.meta}`}>
                            {s.cityName} · {formatDistance(s.distanceMeters)}
                          </span>
                        </ScrollListRow>
                      ))
                    )}
                  </ScrollList>
                )}
              </>
            ) : (
              <>
                {/* 縣市一多（例如之後要加更多縣市）橫向捲動清單會變得很長，改成跟 Ubike 同一套
                    「標籤＋按鈕開彈窗」寫法，點了跳出另一個 BottomSheetModal 選縣市——這個彈窗
                    本身也是 BottomSheetModal，等於是疊兩層，疊起來的堆疊順序看 DOM 掛載順序，
                    後開的（縣市選單）本來就會疊在先開的（這個彈窗）上面，不用特別處理 z-index。
                    縣市跟目前這個模式要打的那個欄位（路線編號／站牌名稱）並排成一排，兩欄高度、
                    padding 對齊，看起來是同一組查詢條件。 */}
                <FieldRow className="gap-3">
                  <Field as="div" label="縣市">
                    <SelectButton value={cityName} onClick={() => setCityPickerOpen(true)} />
                  </Field>

                  {searchMode === "route" ? (
                    <Field as="div" label="路線編號">
                      {/* 路線編號用下面自訂的數字／色塊鍵盤輸入，不是原生文字框（原生鍵盤
                          打不出「紅29」這種組合又慢），所以這裡只顯示目前打到哪。 */}
                      <div className="flex items-center rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                        {query ? (
                          <span className={text.bodyStrong}>{query}</span>
                        ) : (
                          <span className={`truncate ${text.placeholder}`}>例如「{ROUTE_QUERY_EXAMPLE_BY_CITY[cityName] ?? "105"}」</span>
                        )}
                      </div>
                    </Field>
                  ) : (
                    <Field label="站牌名稱">
                      <TextInput type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="輸入站牌名稱" className="px-3" />
                    </Field>
                  )}
                </FieldRow>

                {searchMode === "route" ? (
                  <>
                    {/* 搜尋結果的筆數隨關鍵字變動、猜不到，所以這裡不畫骨架（設計系統的規則：
                        骨架只用在筆數可預測的清單），用「搜尋中…」頂著。 */}
                    <ScrollList className="max-h-32">
                      {searchLoading ? (
                        <ListMessage>{copy.searching}</ListMessage>
                      ) : searchError ? (
                        <ListMessage tone="error">{searchError}</ListMessage>
                      ) : !query.trim() ? (
                        <ListMessage>輸入路線編號開始查詢</ListMessage>
                      ) : routeResults.length === 0 ? (
                        <ListMessage>沒有符合的路線</ListMessage>
                      ) : (
                        routeResults.map((r) => (
                          <ScrollListRow key={r} onClick={() => setStep({ kind: "routeDetail", routeName: r })} className="justify-start">
                            <Badge className={routeBadgeStyle(r)}>{r}</Badge>
                          </ScrollListRow>
                        ))
                      )}
                    </ScrollList>

                    <div className="grid grid-cols-4 gap-2">
                      {keypadForCity(cityName).map((key, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setQuery((q) => (key.label === "⌫" ? q.slice(0, -1) : q + key.insert))}
                          className={`rounded-2xl py-3 text-center text-sm font-semibold transition-colors ${
                            key.tone ? ROUTE_COLOR_PREFIX_STYLE[key.tone] : "bg-[#F8F6FD] text-[#4A3B7C] hover:bg-[#F3EFFC]"
                          }`}
                        >
                          {key.label}
                        </button>
                      ))}
                    </div>

                    {/* 「東山咖啡線」「先導公車」這種名稱裡完全沒有數字的路線，上面的鍵盤（數字＋
                        縣市快速鍵）打不出這幾個字，查詢框也查不到，只能靠瀏覽的方式選。 */}
                    <LinkButton className="self-start" onClick={() => setNamedRoutesOpen(true)}>
                      找不到？瀏覽文字命名路線 →
                    </LinkButton>
                  </>
                ) : (
                  <ScrollList className="max-h-72">
                    {searchLoading ? (
                      <ListMessage>{copy.searching}</ListMessage>
                    ) : searchError ? (
                      <ListMessage tone="error">{searchError}</ListMessage>
                    ) : !query.trim() ? (
                      <ListMessage>輸入站牌名稱開始查詢</ListMessage>
                    ) : stopResults.length === 0 ? (
                      <ListMessage>沒有符合的站牌</ListMessage>
                    ) : (
                      stopResults.map((s) => (
                        <ScrollListRow key={s} onClick={() => setStep({ kind: "stopDetail", stopName: s })} className="justify-start">
                          <span className={text.bodyStrong}>{s}</span>
                        </ScrollListRow>
                      ))
                    )}
                  </ScrollList>
                )}
              </>
            )}
          </>
        )}

        {step.kind === "routeDetail" && (
          <>
            <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
            <ScrollList divided>
              {routeStopsError ? (
                <ListMessage tone="error">{routeStopsError}</ListMessage>
              ) : routeStopsForDirection === null ? (
                // 骨架列數＝這條路線這個方向上次實際的站數，資料回來時清單高度不會跳。
                detailSkeletonCount === 0 ? (
                  <ListMessage>{copy.loading}</ListMessage>
                ) : (
                  <ScrollRowsSkeleton count={detailSkeletonCount} />
                )
              ) : routeStopsForDirection.length === 0 ? (
                <ListMessage>查不到這個方向的站序</ListMessage>
              ) : (
                routeStopsForDirection.map((s) => (
                  <ScrollListRow key={s.name} onClick={() => pickFromRouteDetail(step.routeName, s.name)} className="px-4 py-3">
                    <span className={text.bodyStrong}>{s.name}</span>
                    <Badge className={`font-semibold ${etaToneStyle(s)}`}>{etaLabel(s)}</Badge>
                  </ScrollListRow>
                ))
              )}
            </ScrollList>
          </>
        )}

        {step.kind === "stopDetail" && (
          <>
            <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
            <ScrollList divided>
              {stopRoutesError ? (
                <ListMessage tone="error">{stopRoutesError}</ListMessage>
              ) : stopRoutes === null ? (
                detailSkeletonCount === 0 ? (
                  <ListMessage>{copy.loading}</ListMessage>
                ) : (
                  <ScrollRowsSkeleton count={detailSkeletonCount} />
                )
              ) : stopRoutes.length === 0 ? (
                <ListMessage>目前沒有路線經過這一站</ListMessage>
              ) : stopRoutesForDirection.length === 0 ? (
                <ListMessage>這個方向目前沒有路線經過這一站</ListMessage>
              ) : (
                stopRoutesForDirection.map((r) => (
                  <ScrollListRow key={r.routeName} onClick={() => pickFromStopDetail(r.routeName, r.direction, step.stopName)} className="px-4 py-3">
                    <Badge className={routeBadgeStyle(r.routeName)}>{r.routeName}</Badge>
                    <Badge className={`font-semibold ${etaToneStyle(r)}`}>{etaLabel(r)}</Badge>
                  </ScrollListRow>
                ))
              )}
            </ScrollList>
          </>
        )}
      </BottomSheetModal>

      <BottomSheetModal open={cityPickerOpen} title="選擇縣市" onClose={() => setCityPickerOpen(false)} bodyClassName="flex flex-col gap-2 px-5 py-4">
        {BUS_CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => {
              setCityName(city);
              setCityPickerOpen(false);
              onCityChange?.(city);
            }}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              city === cityName ? "border-[#6F5FD6] bg-[#F3EFFC] text-[#6F5FD6]" : "border-[#ECE4FA] text-[#4A3B7C] hover:bg-[#F3EFFC]"
            }`}
          >
            {city}
          </button>
        ))}
      </BottomSheetModal>

      <BottomSheetModal
        open={namedRoutesOpen}
        title="文字命名路線"
        onClose={() => setNamedRoutesOpen(false)}
        bodyClassName="flex flex-col gap-2 px-5 py-4"
      >
        {namedRoutesError ? (
          <p className={`px-1 py-3 text-center ${text.error}`}>{namedRoutesError}</p>
        ) : namedRoutes === null ? (
          <p className={`px-1 py-3 text-center ${text.hint}`}>{copy.loading}</p>
        ) : namedRoutes.length === 0 ? (
          <p className={`px-1 py-3 text-center ${text.hint}`}>這個縣市沒有純文字命名的路線</p>
        ) : (
          namedRoutes.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pickNamedRoute(r)}
              className="rounded-2xl border border-[#ECE4FA] px-4 py-3 text-left text-sm font-medium text-[#4A3B7C] transition-colors hover:bg-[#F3EFFC]"
            >
              {r}
            </button>
          ))
        )}
      </BottomSheetModal>
    </>
  );
}
