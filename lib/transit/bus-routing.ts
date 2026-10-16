import { tdxGet, TDX_TTL } from "./tdx-client";
import { getDb } from "../mongodb";
import { distanceMeters } from "../geo";

// 跟 lib/metro-lines.ts 的 METRO_SYSTEM_CODE 同一個概念：畫面上顯示用中文縣市名，打 TDX
// 要用英文城市代碼，跟 components/transit/bus-cities.ts 的 BUS_CITIES 一起維護。這份縣市
// 清單是逐一打過 /v2/Bus/StopOfRoute/City/{code} 確認過真的有實際路線資料才列進來——
// 苗栗縣雖然 YouBike 有站點，但公車只查得到 1 條路線，等於沒有真的公車資料，所以不收。
export const BUS_CITY_CODE: Record<string, string> = {
  台北市: "Taipei",
  新北市: "NewTaipei",
  桃園市: "Taoyuan",
  基隆市: "Keelung",
  新竹市: "Hsinchu",
  新竹縣: "HsinchuCounty",
  台中市: "Taichung",
  彰化縣: "ChanghuaCounty",
  台南市: "Tainan",
  高雄市: "Kaohsiung",
};

// 各縣市的大致中心點（市中心／縣政府所在地），只用來做「附近站牌」的粗篩：使用者的座標
// 離哪幾個縣市比較近，就只查那幾個縣市的站牌清單。以前是不管使用者在哪，一次把 10 個
// 縣市的站牌清單全查一遍再排序——TDX 每分鐘只有 5 次額度，冷快取時那 10 個請求一定有
// 一半以上被擋掉，而且整包幾 MB 的站牌座標還得送到瀏覽器端才開始算距離。
const BUS_CITY_CENTER: Record<string, { lat: number; lng: number }> = {
  台北市: { lat: 25.0375, lng: 121.5637 },
  新北市: { lat: 25.0169, lng: 121.4628 },
  桃園市: { lat: 24.9937, lng: 121.2969 },
  基隆市: { lat: 25.1276, lng: 121.7392 },
  新竹市: { lat: 24.8138, lng: 120.9675 },
  新竹縣: { lat: 24.8276, lng: 121.0177 },
  台中市: { lat: 24.1477, lng: 120.6736 },
  彰化縣: { lat: 24.0809, lng: 120.5386 },
  台南市: { lat: 22.9999, lng: 120.227 },
  高雄市: { lat: 22.6273, lng: 120.3014 },
};

// 粗篩的半徑跟上限：縣市本身有大小，用中心點算距離會有誤差，所以半徑放寬到 45 公里
// （雙北／基隆／桃園這種相鄰縣市都會一起入選），再取最近的 3 個縣市。實際驗算過：在
// 台北車站會選到台北＋新北＋基隆，在中壢會選到桃園＋新竹縣＋新竹市，都涵蓋到真正走得
// 到的站牌；更遠的縣市本來也不可能出現在「附近」清單裡。
const NEARBY_CITY_RADIUS_M = 45_000;
const NEARBY_CITY_LIMIT = 3;

// 公車站序幾乎不會變，快取 24 小時；即時到站預估時間本來就會變，用 tdxGet 預設的 60 秒
// 快取就好（同一分鐘內重複查詢不用一直打 TDX，但也不會舊到離譜）。
const DAY_MS = TDX_TTL.static;

interface StopOfRouteEntry {
  RouteUID: string;
  RouteName: { Zh_tw: string };
  Direction: number;
  Stops: {
    StopUID: string;
    StopName: { Zh_tw: string };
    StopSequence: number;
    StopPosition: { PositionLat: number; PositionLon: number };
  }[];
}

/** 壓縮後的站序資料——只留畫面真正會用到的欄位，欄位名稱也縮短。 */
interface CompactStop {
  uid: string;
  name: string;
  seq: number;
  lat: number;
  lng: number;
}

interface CompactRoute {
  route: string;
  direction: number;
  stops: CompactStop[];
}

interface BusRoutesCacheDoc {
  _id: string; // cityCode
  routes: CompactRoute[];
  expiresAt: Date;
}

// 同一個 function instance 連續查同個縣市時完全不用等 Mongo 往返；存 promise 不是存值，
// 順便處理同一 instance 內多個併發請求打同個縣市的情況（大家等同一個 promise）。
const routesMemCache = new Map<string, { promise: Promise<CompactRoute[]>; expiresAt: number }>();

/**
 * 某個縣市全部路線的站序（去程／返程各一筆）。
 *
 * TDX 的 /v2/Bus/StopOfRoute/City/{code} 原始回應很肥（台北市、新北市這種大城市是好幾
 * MB，每個站牌還附帶十幾個這裡用不到的欄位）。直接交給 tdxGet 的 Mongo 快取存原始回應
 * 有兩個問題：(1) 大城市可能撞到 MongoDB 單一文件 16MB 上限、寫入失敗（原本是靜默吞掉
 * 錯誤），等於這個縣市永遠沒有快取、每次冷啟動都重打一次 TDX；(2) 就算存進去了，每次
 * 讀取都要從 Mongo 搬好幾 MB 回來。
 *
 * 所以這裡自己管一份「壓縮後」的快取：只存路線名稱／方向／站牌（UID、站名、站序、座標），
 * 體積大約是原始回應的十分之一，24 小時內同一個縣市不管被查幾次、哪個端點查、冷啟動
 * 幾次，都只會真的打 TDX 一次。
 */
async function getStopOfRouteList(cityCode: string): Promise<CompactRoute[]> {
  const cached = routesMemCache.get(cityCode);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (async () => {
    const db = await getDb();
    const coll = db.collection<BusRoutesCacheDoc>("transit.busRoutes");

    const doc = await coll.findOne({ _id: cityCode });
    if (doc && doc.expiresAt.getTime() > Date.now()) return doc.routes;

    // persist: false——原始回應不要再進 tdxCache 存一份（見上面的理由），壓縮完由這裡
    // 自己存進 transit.busRoutes。
    const entries = await tdxGet<StopOfRouteEntry[]>(`/v2/Bus/StopOfRoute/City/${cityCode}`, DAY_MS, { persist: false });
    const routes: CompactRoute[] = entries.map((e) => ({
      route: e.RouteName.Zh_tw,
      direction: e.Direction,
      stops: e.Stops.map((s) => ({
        uid: s.StopUID,
        name: s.StopName.Zh_tw,
        seq: s.StopSequence,
        lat: s.StopPosition.PositionLat,
        lng: s.StopPosition.PositionLon,
      })),
    }));

    // 快取寫入失敗不該讓這次查詢跟著失敗（使用者已經拿到資料了），吞掉錯誤就好。
    await coll
      .updateOne({ _id: cityCode }, { $set: { routes, expiresAt: new Date(Date.now() + DAY_MS) } }, { upsert: true })
      .catch(() => {});

    return routes;
  })();

  routesMemCache.set(cityCode, { promise, expiresAt: Date.now() + DAY_MS });
  // 失敗不留快取，下一次請求可以重新嘗試。
  promise.catch(() => routesMemCache.delete(cityCode));
  return promise;
}

interface EtaRow {
  StopUID: string;
  RouteName: { Zh_tw: string };
  Direction: number;
  StopStatus: number;
  EstimateTime?: number; // 秒
}

async function getEtaList(cityCode: string): Promise<EtaRow[]> {
  return tdxGet<EtaRow[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${cityCode}`, TDX_TTL.realtime);
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
  const names = new Set(entries.map((e) => e.route));
  const q = query.trim();
  const filtered = q ? [...names].filter((n) => n.includes(q)) : [...names];
  return filtered.sort((a, b) => a.localeCompare(b, "zh-Hant")).slice(0, SUGGESTION_LIMIT);
}

// 名稱裡完全沒有數字的路線（例如台南「東山咖啡線」、新竹「先導公車」）——這種路線沒有
// 數字可以靠縣市快速鍵／數字鍵盤打出來，查詢框完全打不出這幾個字，只能用瀏覽的方式選。
// 故意不套用 SUGGESTION_LIMIT 那個 30 筆上限：這份清單本來就很短（通常個位數到十幾筆），
// 而且是給「瀏覽」用的完整清單，不是打字篩選的建議清單，裁掉反而會漏掉一些路線。
export async function getNamedBusRoutes(cityName: string): Promise<string[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const entries = await getStopOfRouteList(cityCode);
  const names = new Set(entries.map((e) => e.route));
  return [...names].filter((n) => !/\d/.test(n)).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

export async function searchBusStops(cityName: string, query: string): Promise<string[]> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return [];
  const entries = await getStopOfRouteList(cityCode);
  const names = new Set<string>();
  for (const entry of entries) for (const s of entry.stops) names.add(s.name);
  const q = query.trim();
  const filtered = q ? [...names].filter((n) => n.includes(q)) : [...names];
  return filtered.sort((a, b) => a.localeCompare(b, "zh-Hant")).slice(0, SUGGESTION_LIMIT);
}

export interface BusStopEta {
  name: string;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

// 某條路線的完整真實站序——去程、返程一次抓回來，各自帶上當下的即時到站狀態。兩個方向
// 一次查完是因為使用者在路線詳情畫面切換去程/返程很常見，而即時到站端點本來就是整個
// 城市一次撈回來，兩個方向的資料原本就在同一筆回應裡，沒必要切換方向就重打一次 TDX。
export async function getRouteStops(cityName: string, routeName: string): Promise<Record<0 | 1, BusStopEta[]>> {
  const cityCode = BUS_CITY_CODE[cityName];
  if (!cityCode) return { 0: [], 1: [] };
  const [entries, etaList] = await Promise.all([getStopOfRouteList(cityCode), getEtaList(cityCode)]);

  function stopsForDirection(direction: 0 | 1): BusStopEta[] {
    const entry = entries.find((e) => e.route === routeName && e.direction === direction);
    if (!entry) return [];
    const etaByStopUID = new Map(
      etaList.filter((r) => r.RouteName.Zh_tw === routeName && r.Direction === direction).map((r) => [r.StopUID, r]),
    );
    return [...entry.stops]
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({ name: s.name, ...classifyEta(etaByStopUID.get(s.uid)) }));
  }

  return { 0: stopsForDirection(0), 1: stopsForDirection(1) };
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
    const stop = entry.stops.find((s) => s.name === stopName);
    if (!stop) continue;
    const key = `${entry.route}|${entry.direction}`;
    if (seenRouteDirection.has(key)) continue;
    seenRouteDirection.add(key);
    const row = etaByKey.get(`${key}|${stop.uid}`);
    results.push({ routeName: entry.route, direction: entry.direction as 0 | 1, ...classifyEta(row) });
  }

  return results.sort((a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999));
}

export interface NearbyBusStop {
  stopUID: string;
  name: string;
  cityName: string;
  distanceMeters: number;
}

/** 使用者座標附近的縣市（依中心點距離粗篩），最多 NEARBY_CITY_LIMIT 個。 */
function nearbyCityNames(lat: number, lng: number): string[] {
  const ranked = Object.keys(BUS_CITY_CODE)
    .map((city) => {
      const center = BUS_CITY_CENTER[city];
      return { city, distance: center ? distanceMeters(lat, lng, center.lat, center.lng) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.distance - b.distance);

  const within = ranked.filter((r) => r.distance <= NEARBY_CITY_RADIUS_M).slice(0, NEARBY_CITY_LIMIT);
  // 全部縣市都在半徑外（使用者在花東、外島或國外）時，還是給最近的那一個，讓畫面至少
  // 顯示得出「最近的站牌在很遠的地方」，不要變成一個沒有任何說明的空清單。
  return (within.length > 0 ? within : ranked.slice(0, 1)).map((r) => r.city);
}

/**
 * 附近站牌：使用者座標附近幾個縣市的實體站牌，依距離排序後取前 limit 筆。
 *
 * 排序、去重、裁切全部在伺服器端做完——附近站牌只需要前 20 筆，以前是把好幾個縣市
 * 完整的站牌座標清單（幾 MB）送到瀏覽器端才開始算距離，流量跟時間都是白花的。
 *
 * 去重用「站名」而不是 StopUID：同一個站名常常掛著好幾支不同 UID 的牌子（路口兩側、
 * 不同路線各立一支，甚至同一個實體站牌同時登記在兩個縣市的公車系統底下——例如台北車站
 * 周邊很多站是台北市、新北市都有停，TDX 兩邊各自登記一次）。清單已經先按距離排序，
 * 留下的一定是最近的那一支。
 */
export async function getNearbyBusStops(lat: number, lng: number, limit: number): Promise<NearbyBusStop[]> {
  const cities = nearbyCityNames(lat, lng);
  const lists = await Promise.all(
    cities.map(async (city) => {
      try {
        const entries = await getStopOfRouteList(BUS_CITY_CODE[city]);
        const byUID = new Map<string, NearbyBusStop>();
        for (const entry of entries) {
          for (const s of entry.stops) {
            if (byUID.has(s.uid)) continue;
            byUID.set(s.uid, {
              stopUID: s.uid,
              name: s.name,
              cityName: city,
              distanceMeters: distanceMeters(lat, lng, s.lat, s.lng),
            });
          }
        }
        return [...byUID.values()];
      } catch {
        // 某個縣市查失敗（例如 TDX 額度用完）不要讓整個附近站牌查詢跟著失敗，其他縣市
        // 查到的結果照樣顯示得出來。
        return [];
      }
    }),
  );

  const sorted = lists.flat().sort((a, b) => a.distanceMeters - b.distanceMeters);
  const seen = new Set<string>();
  const merged: NearbyBusStop[] = [];
  for (const s of sorted) {
    if (seen.has(s.name)) continue;
    seen.add(s.name);
    merged.push(s);
    if (merged.length >= limit) break;
  }
  return merged;
}
