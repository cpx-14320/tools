import { tdxGet } from "./tdx-client";

interface TdxBikeStationRow {
  StationUID: string;
  StationName: { Zh_tw: string };
  StationPosition: { PositionLat: number; PositionLon: number };
  BikesCapacity: number;
}

interface TdxBikeAvailabilityRow {
  StationUID: string;
  AvailableRentBikes: number;
  AvailableReturnBikes: number;
}

export interface YouBikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  // 即時車輛數查失敗（額度用完等情況）時就不帶這兩個欄位，站點本身（名稱＋座標）還是
  // 要能顯示，不能因為即時資料查不到就整個站點都不見。
  availableBikes?: number;
  availableDocks?: number;
}

// 站點本身（名稱、座標、容量）幾乎不會變，跟車站清單一樣快取 24 小時；即時車輛數變動快，
// 快取時間對齊 TDX 帳號額度重置週期（60 秒），不要每次地圖互動都重新打一次。
const STATION_TTL_MS = 24 * 60 * 60 * 1000;
const AVAILABILITY_TTL_MS = 60_000;

export async function getYouBikeStations(cityCode: string): Promise<YouBikeStation[]> {
  const stations = await tdxGet<TdxBikeStationRow[]>(`/v2/Bike/Station/City/${cityCode}?%24top=1000`, STATION_TTL_MS);

  let availability: TdxBikeAvailabilityRow[] = [];
  try {
    availability = await tdxGet<TdxBikeAvailabilityRow[]>(`/v2/Bike/Availability/City/${cityCode}?%24top=1000`, AVAILABILITY_TTL_MS);
  } catch {
    // 額度不夠或這次查詢失敗，即時車輛數就留空，站點清單本身（下面）仍然正常回傳。
  }
  const availByUid = new Map(availability.map((a) => [a.StationUID, a]));

  return stations.map((s) => {
    const avail = availByUid.get(s.StationUID);
    return {
      id: s.StationUID,
      name: s.StationName.Zh_tw.replace(/^YouBike2?\.?0?_/, ""),
      lat: s.StationPosition.PositionLat,
      lng: s.StationPosition.PositionLon,
      capacity: s.BikesCapacity,
      availableBikes: avail?.AvailableRentBikes,
      availableDocks: avail?.AvailableReturnBikes,
    };
  });
}
