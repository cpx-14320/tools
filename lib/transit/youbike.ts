import { tdxGet } from "./tdx-client";

// 中文縣市名稱對照 TDX 的英文城市代碼——逐一打過 /v2/Bike/Station/City/{code} 確認過真的
// 有站點資料才列進來（見 components/transit/youbike-cities.ts 的 YOUBIKE_CITIES，兩邊的
// 中文名稱要對得起來）。YouBike2.0 的服務範圍比公車查詢共用的 4 個縣市廣，不要共用
// lib/transit/bus-routing.ts 的 BUS_CITY_CODE，那份是刻意只收公車查詢支援的縣市。
export const YOUBIKE_CITY_CODE: Record<string, string> = {
  台北市: "Taipei",
  新北市: "NewTaipei",
  桃園市: "Taoyuan",
  基隆市: "Keelung",
  新竹市: "Hsinchu",
  新竹縣: "HsinchuCounty",
  苗栗縣: "MiaoliCounty",
  台中市: "Taichung",
  彰化縣: "ChanghuaCounty",
  台南市: "Tainan",
  高雄市: "Kaohsiung",
};

interface TdxBikeStationRow {
  StationUID: string;
  StationName: { Zh_tw: string };
  StationPosition: { PositionLat: number; PositionLon: number };
}

export interface YouBikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// 只查站點本身（名稱、座標），不查即時可借/可還車輛數——這兩個是 TDX 分開的端點，站點
// 清單幾乎不會變，比照車站清單用 24 小時快取；不查即時車輛數也省一份額度，之後真的要顯示
// 車輛數再另外加 /v2/Bike/Availability/City/{cityCode} 這個端點即可，不影響這裡的站點清單。
const STATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function getYouBikeStations(cityCode: string): Promise<YouBikeStation[]> {
  const rows = await tdxGet<TdxBikeStationRow[]>(`/v2/Bike/Station/City/${cityCode}?%24top=1000`, STATION_TTL_MS);
  return rows.map((s) => ({
    id: s.StationUID,
    name: s.StationName.Zh_tw.replace(/^YouBike2?\.?0?_/, ""),
    lat: s.StationPosition.PositionLat,
    lng: s.StationPosition.PositionLon,
  }));
}
