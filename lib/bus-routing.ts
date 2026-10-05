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
  // 0＝正常有預估值；其他代碼代表交管、末班車已過、尚未發車等，這些狀況下 EstimateTime
  // 不可信，不能顯示。
  StopStatus: number;
  EstimateTime?: number; // 秒
}

async function getEtaList(cityCode: string): Promise<EtaRow[]> {
  return tdxGet<EtaRow[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${cityCode}`);
}

export interface BusRouteMatch {
  routeName: string;
  /** 出發站到抵達站之間經過的站數（含抵達站，不含出發站本身），是從真實站序算出來的。 */
  stops: number;
  /** 幾分鐘後有這班車到出發站；null＝目前沒有可信的預估值（末班已過或資料缺漏）。 */
  etaMinutes: number | null;
}

/** 同一個站名在同一條路線的「去程」「返程」常常分成兩個不同 entry（各自只收那個方向的
 *  站），比對時兩個方向都要找，站序小的是出發站、站序大的才是抵達站（方向要對，不能反過來）。 */
function pairingsOf(entry: StopOfRouteEntry, originStop: string, destStop: string): { originStopUID: string; stops: number } | null {
  const originRow = entry.Stops.find((s) => s.StopName.Zh_tw === originStop);
  const destRow = entry.Stops.find((s) => s.StopName.Zh_tw === destStop);
  if (!originRow || !destRow || originRow.StopSequence >= destRow.StopSequence) return null;
  return { originStopUID: originRow.StopUID, stops: destRow.StopSequence - originRow.StopSequence };
}

/** 出發、抵達站可能不同城市（公車路線本來就會跨縣市），兩個城市的路線清單都要查，不能只
 *  查出發站那個城市——不然出發站在新北市、抵達站在台北市的跨市路線會漏掉。 */
export async function findBusRoutes(originCity: string, originStop: string, destCity: string, destStop: string): Promise<BusRouteMatch[]> {
  const cities = [...new Set([originCity, destCity])];
  const perCity = await Promise.all(
    cities.map(async (city) => ({ city, entries: await getStopOfRouteList(BUS_CITY_CODE[city]) })),
  );

  const matches: (BusRouteMatch & { city: string; originStopUID: string })[] = [];
  const seenRouteNames = new Set<string>();
  for (const { city, entries } of perCity) {
    for (const entry of entries) {
      const pairing = pairingsOf(entry, originStop, destStop);
      if (!pairing) continue;
      // 同一條路線的去程／返程 entry 都可能比對到（理論上只有其中一個方向會對），但保險起見
      // 同一個路線名只收一次，避免重複列出。
      if (seenRouteNames.has(entry.RouteName.Zh_tw)) continue;
      seenRouteNames.add(entry.RouteName.Zh_tw);
      matches.push({ city, routeName: entry.RouteName.Zh_tw, stops: pairing.stops, etaMinutes: null, originStopUID: pairing.originStopUID });
    }
  }

  if (matches.length === 0) return [];

  // 查即時到站：依城市分組查（額度有限，不用每個比對到的路線各查一次，同城市共用一份清單）。
  // city 數量最多 2（出發、抵達各一個），不會超過 TDX 每分鐘 5 次的額度。
  const etaByCity = new Map<string, EtaRow[]>();
  for (const city of new Set(matches.map((m) => m.city))) {
    etaByCity.set(city, await getEtaList(BUS_CITY_CODE[city]));
  }

  for (const m of matches) {
    const row = (etaByCity.get(m.city) ?? []).find((e) => e.RouteName.Zh_tw === m.routeName && e.StopUID === m.originStopUID);
    if (row && row.StopStatus === 0 && row.EstimateTime !== undefined) {
      m.etaMinutes = Math.max(0, Math.round(row.EstimateTime / 60));
    }
  }

  // 快到的排前面；沒有預估值的（末班已過等）排最後。
  return matches
    .sort((a, b) => (a.etaMinutes ?? 9999) - (b.etaMinutes ?? 9999))
    .map(({ routeName, stops, etaMinutes }) => ({ routeName, stops, etaMinutes }));
}
