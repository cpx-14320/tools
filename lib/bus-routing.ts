import { tdxGet } from "./tdx-client";

// 跟 lib/metro-lines.ts 的 METRO_SYSTEM_CODE 同一個概念：畫面上顯示用中文縣市名，打 TDX
// 要用英文城市代碼，跟 components/dream/stations-data.ts 的 STATIONS_BY_CITY.bus 的 key
// 一起維護。
export const BUS_CITY_CODE: Record<string, string> = {
  台北市: "Taipei",
  新北市: "NewTaipei",
  桃園市: "Taoyuan",
  基隆市: "Keelung",
};

// 公車站序幾乎不會變，快取 24 小時；即時到站預估時間本來就會變，用 tdxGet 預設的 60 秒
// 快取就好（同一分鐘內重複查詢不用一直打 TDX，但也不會舊到離譜）。
const DAY_MS = 24 * 60 * 60 * 1000;

interface StopOfRouteEntry {
  RouteUID: string;
  RouteName: { Zh_tw: string };
  Direction: number;
  Stops: { StopUID: string; StopName: { Zh_tw: string }; StopSequence: number }[];
}

async function getStopOfRouteList(cityCode: string): Promise<StopOfRouteEntry[]> {
  return tdxGet<StopOfRouteEntry[]>(`/v2/Bus/StopOfRoute/City/${cityCode}`, DAY_MS);
}

interface EtaRow {
  StopUID: string;
  RouteName: { Zh_tw: string };
  Direction: number;
  StopStatus: number;
  EstimateTime?: number; // 秒
}

async function getEtaList(cityCode: string): Promise<EtaRow[]> {
  return tdxGet<EtaRow[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${cityCode}`);
}

export type BusEtaStatus = "ok" | "arriving" | "notStarted" | "pastLast" | "unavailable";

export interface BusEtaInfo {
  status: BusEtaStatus;
  /** 只有 status === "ok" 才會有值，其他狀態的倒數分鐘數不可信，不顯示。 */
  etaMinutes: number | null;
}

// EstimateTime 倒數到 59 秒內之後 TDX 就不再更新這個值，官方文件只明訂 StopStatus=1 是
// 「尚未發車」；2（交管不停靠）、3（末班已過）是社群／多個第三方公車 App 共同採用的慣例，
// 不是 TDX 官方逐一列舉的文件，但目前查到的即時資料都符合這個對照，查不到才退回「無資料」。
const ARRIVING_THRESHOLD_SECONDS = 59;

function classifyEta(row: EtaRow | undefined): BusEtaInfo {
  if (!row) return { status: "unavailable", etaMinutes: null };
  if (row.StopStatus === 1) return { status: "notStarted", etaMinutes: null };
  if (row.StopStatus === 3) return { status: "pastLast", etaMinutes: null };
  if (row.StopStatus !== 0 || row.EstimateTime === undefined) return { status: "unavailable", etaMinutes: null };
  if (row.EstimateTime <= ARRIVING_THRESHOLD_SECONDS) return { status: "arriving", etaMinutes: null };
  return { status: "ok", etaMinutes: Math.max(1, Math.round(row.EstimateTime / 60)) };
}

// 路線／站牌清單幾乎不會變動，但一個大城市可能有幾百條路線、幾千個站牌名稱，不管有沒有
// 輸入查詢字都整包塞回前端沒有意義（畫面上的清單本來就只滾動一小塊），固定裁到前 30 筆、
// 依筆畫／字母排序，使用者多打幾個字就會篩到想要的那筆。
const SUGGESTION_LIMIT = 30;

export async function searchBusRoutes(cityName: string, query: string): Promise<string[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const entries = await getStopOfRouteList(cityCode);
  const names = new Set(entries.map((e) => e.RouteName.Zh_tw));
  const q = query.trim();
  const filtered = q ? [...names].filter((n) => n.includes(q)) : [...names];
  return filtered.sort((a, b) => a.localeCompare(b, "zh-Hant")).slice(0, SUGGESTION_LIMIT);
}

export async function searchBusStops(cityName: string, query: string): Promise<string[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const entries = await getStopOfRouteList(cityCode);
  const names = new Set<string>();
  for (const entry of entries) for (const s of entry.Stops) names.add(s.StopName.Zh_tw);
  const q = query.trim();
  const filtered = q ? [...names].filter((n) => n.includes(q)) : [...names];
  return filtered.sort((a, b) => a.localeCompare(b, "zh-Hant")).slice(0, SUGGESTION_LIMIT);
}

export interface BusStopEta {
  name: string;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

/** 某條路線＋某個方向的完整真實站序，每一站都帶上當下的即時到站狀態。 */
export async function getRouteStops(cityName: string, routeName: string, direction: 0 | 1): Promise<BusStopEta[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const [entries, etaList] = await Promise.all([getStopOfRouteList(cityCode), getEtaList(cityCode)]);
  const entry = entries.find((e) => e.RouteName.Zh_tw === routeName && e.Direction === direction);
  if (!entry) return [];
  const etaByStopUID = new Map(
    etaList.filter((r) => r.RouteName.Zh_tw === routeName && r.Direction === direction).map((r) => [r.StopUID, r]),
  );
  return [...entry.Stops]
    .sort((a, b) => a.StopSequence - b.StopSequence)
    .map((s) => ({ name: s.StopName.Zh_tw, ...classifyEta(etaByStopUID.get(s.StopUID)) }));
}

export interface StopRouteEta {
  routeName: string;
  direction: 0 | 1;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

/** 目前有停靠這個站牌名稱的所有路線（去程／返程分開列），各自帶上即時到站狀態。 */
export async function getStopRoutes(cityName: string, stopName: string): Promise<StopRouteEta[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const [entries, etaList] = await Promise.all([getStopOfRouteList(cityCode), getEtaList(cityCode)]);
  const etaByKey = new Map(etaList.map((r) => [`${r.RouteName.Zh_tw}|${r.Direction}|${r.StopUID}`, r]));

  const results: StopRouteEta[] = [];
  const seenRouteDirection = new Set<string>();
  for (const entry of entries) {
    const stop = entry.Stops.find((s) => s.StopName.Zh_tw === stopName);
    if (!stop) continue;
    const key = `${entry.RouteName.Zh_tw}|${entry.Direction}`;
    if (seenRouteDirection.has(key)) continue;
    seenRouteDirection.add(key);
    const row = etaByKey.get(`${key}|${stop.StopUID}`);
    results.push({ routeName: entry.RouteName.Zh_tw, direction: entry.Direction as 0 | 1, ...classifyEta(row) });
  }

  return results.sort((a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999));
}
