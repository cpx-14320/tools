"use client";

import { useEffect, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { FaIcon } from "./fa-icon";
import { BUS_CITIES } from "./bus-cities";
import type { BusEtaStatus } from "@/lib/transit/bus-routing";

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
const routeStopsCache = new Map<string, ClientCacheEntry<BusStopEta[]>>();
const stopRoutesCache = new Map<string, ClientCacheEntry<StopRouteEta[]>>();

type Step = { kind: "search" } | { kind: "routeDetail"; routeName: string } | { kind: "stopDetail"; stopName: string };

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
      <div className="inline-flex items-center gap-1 rounded-full bg-[#F3EFFC] p-1">
        {([0, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChangeDirection(d)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              direction === d ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
            }`}
          >
            {d === 0 ? "去程" : "返程"}
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
        ‹ 重新搜尋
      </button>
    </div>
  );
}

export function BusRoutePickerModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<BusRouteSelection>;
  onClose: () => void;
  onSave: (selection: BusRouteSelection) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [searchMode, setSearchMode] = useState<"route" | "stop">("stop");
  const [query, setQuery] = useState("");
  const [cityName, setCityName] = useState(initial?.cityName && BUS_CITIES.includes(initial.cityName) ? initial.cityName : BUS_CITIES[0]);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [direction, setDirection] = useState<0 | 1>(initial?.direction ?? 0);

  const [routeResults, setRouteResults] = useState<string[]>([]);
  const [stopResults, setStopResults] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        if (!cancelled) setNamedRoutesError("查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [namedRoutesOpen, cityName]);

  // 搜尋路線／站牌：依目前選的縣市＋輸入字即時查真實 TDX 資料，不是前端自己過濾假清單。
  // 小鍵盤／文字框每打一個字就會變動查詢字，debounce 200ms 再查，不用每個按鍵都打一次。
  // 還沒輸入任何字就不查——彈窗一打開 query 是空字串，不應該平白無故先打一次 API。
  useEffect(() => {
    if (step.kind !== "search") return;

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
          if (!cancelled) setSearchError("查詢失敗，請稍後再試");
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
  const [routeStops, setRouteStops] = useState<BusStopEta[] | null>(null);
  const [routeStopsError, setRouteStopsError] = useState<string | null>(null);

  // 路線詳情：某條路線＋某個方向的真實站序，每一站都帶即時到站狀態。
  useEffect(() => {
    if (!routeNameForDetail) return;

    const cacheKey = `${cityName}|${routeNameForDetail}|${direction}`;
    const cached = getCached(routeStopsCache, cacheKey);
    if (cached) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRouteStops(cached);
      setRouteStopsError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;
    setRouteStops(null);
    setRouteStopsError(null);
    const qs = new URLSearchParams({ city: cityName, route: routeNameForDetail, direction: String(direction) });
    fetch(`/api/transit/bus/route-stops?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stops?: BusStopEta[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setRouteStopsError(data.error);
          return;
        }
        const stops = data.stops ?? [];
        setCached(routeStopsCache, cacheKey, stops, ETA_CACHE_TTL_MS);
        setRouteStops(stops);
      })
      .catch(() => {
        if (!cancelled) setRouteStopsError("查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [routeNameForDetail, direction, cityName]);

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
      })
      .catch(() => {
        if (!cancelled) setStopRoutesError("查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [stopNameForDetail, cityName]);

  // 站牌詳情也要能用去程／返程 tabs 切換：查回來的清單本來就每筆各自帶真實方向，這裡只是
  // 依目前選的方向過濾顯示，不用另外多打一次 API。
  const stopRoutesForDirection = (stopRoutes ?? []).filter((r) => r.direction === direction);

  if (!open) return null;

  function close() {
    setStep({ kind: "search" });
    setSearchMode("stop");
    setQuery("");
    setDirection(0);
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
          <div className="inline-flex w-fit items-center gap-1 self-start rounded-full bg-[#F3EFFC] p-1">
            {(["stop", "route"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSearchMode(m);
                  setQuery("");
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  searchMode === m ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
                }`}
              >
                {m === "route" ? "路線" : "站牌"}
              </button>
            ))}
          </div>

          {/* 縣市一多（例如之後要加更多縣市）橫向捲動清單會變得很長，改成跟 Ubike 同一套
              「標籤＋按鈕開彈窗」寫法，點了跳出另一個 BottomSheetModal 選縣市——這個彈窗
              本身也是 BottomSheetModal，等於是疊兩層，疊起來的堆疊順序看 DOM 掛載順序，
              後開的（縣市選單）本來就會疊在先開的（這個彈窗）上面，不用特別處理 z-index。
              縣市跟目前這個模式要打的那個欄位（路線編號／站牌名稱）並排成一排，兩欄高度、
              padding 對齊，看起來是同一組查詢條件。 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">縣市</span>
              <button
                type="button"
                onClick={() => setCityPickerOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left text-sm text-[#4A3B7C]"
              >
                <span className="flex-1 truncate font-medium">{cityName}</span>
                <FaIcon icon="chevron-down" size={12} className="text-[#C7BFE6]" />
              </button>
            </label>

            {searchMode === "route" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#9C94C4]">路線編號</span>
                <div className="flex items-center rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-sm font-medium text-[#4A3B7C]">
                  {query || (
                    <span className="truncate text-[#C7BFE6]">例如「{ROUTE_QUERY_EXAMPLE_BY_CITY[cityName] ?? "105"}」</span>
                  )}
                </div>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[#9C94C4]">站牌名稱</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="輸入站牌名稱"
                  className="rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
                />
              </label>
            )}
          </div>

          {searchMode === "route" ? (
            <>
              <div className="flex max-h-32 flex-col overflow-y-auto rounded-2xl border border-[#F2EEFA]">
                {searchLoading ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">搜尋中…</p>
                ) : searchError ? (
                  <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{searchError}</p>
                ) : !query.trim() ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">輸入路線編號開始查詢</p>
                ) : routeResults.length === 0 ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">沒有符合的路線</p>
                ) : (
                  routeResults.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStep({ kind: "routeDetail", routeName: r })}
                      className="flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#F8F6FD]"
                    >
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${routeBadgeStyle(r)}`}>{r}</span>
                    </button>
                  ))
                )}
              </div>

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
              <button type="button" onClick={() => setNamedRoutesOpen(true)} className="self-start text-xs font-medium text-[#6F5FD6]">
                找不到？瀏覽文字命名路線 →
              </button>
            </>
          ) : (
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-2xl border border-[#F2EEFA]">
              {searchLoading ? (
                <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">搜尋中…</p>
              ) : searchError ? (
                <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{searchError}</p>
              ) : !query.trim() ? (
                <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">輸入站牌名稱開始查詢</p>
              ) : stopResults.length === 0 ? (
                <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">沒有符合的站牌</p>
              ) : (
                stopResults.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStep({ kind: "stopDetail", stopName: s })}
                    className="px-4 py-2.5 text-left text-sm font-medium text-[#4A3B7C] transition-colors hover:bg-[#F8F6FD]"
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}

      {step.kind === "routeDetail" && (
        <>
          <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#F2EEFA]">
            {routeStopsError ? (
              <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{routeStopsError}</p>
            ) : routeStops === null ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查詢中…</p>
            ) : routeStops.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查不到這個方向的站序</p>
            ) : (
              routeStops.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => pickFromRouteDetail(step.routeName, s.name)}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#F8F6FD]"
                >
                  <span className="text-sm font-medium text-[#4A3B7C]">{s.name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${etaToneStyle(s)}`}>{etaLabel(s)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {step.kind === "stopDetail" && (
        <>
          <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#F2EEFA]">
            {stopRoutesError ? (
              <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{stopRoutesError}</p>
            ) : stopRoutes === null ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查詢中…</p>
            ) : stopRoutes.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">目前沒有路線經過這一站</p>
            ) : stopRoutesForDirection.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">這個方向目前沒有路線經過這一站</p>
            ) : (
              stopRoutesForDirection.map((r) => (
                <button
                  key={r.routeName}
                  type="button"
                  onClick={() => pickFromStopDetail(r.routeName, r.direction, step.stopName)}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#F8F6FD]"
                >
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${routeBadgeStyle(r.routeName)}`}>{r.routeName}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${etaToneStyle(r)}`}>{etaLabel(r)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </BottomSheetModal>

    <BottomSheetModal
      open={cityPickerOpen}
      title="選擇縣市"
      onClose={() => setCityPickerOpen(false)}
      bodyClassName="flex flex-col gap-2 px-5 py-4"
    >
      {BUS_CITIES.map((city) => (
        <button
          key={city}
          type="button"
          onClick={() => {
            setCityName(city);
            setCityPickerOpen(false);
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
        <p className="px-1 py-3 text-center text-xs text-[#D1517E]">{namedRoutesError}</p>
      ) : namedRoutes === null ? (
        <p className="px-1 py-3 text-center text-xs text-[#B3ABD4]">查詢中…</p>
      ) : namedRoutes.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-[#B3ABD4]">這個縣市沒有純文字命名的路線</p>
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
