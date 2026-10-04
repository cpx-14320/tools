import { tdxGet } from "./tdx-client";

interface TdxBusStopRow {
  StopUID: string;
  StopName: { Zh_tw: string };
  StopPosition: { PositionLat: number; PositionLon: number };
}

export interface BusStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// 公車站牌清單幾乎不會變，跟車站清單一樣快取 24 小時；這份只是列站點位置，不含即時到站
// 資訊（頁面不需要看行車路線／即時到站，單純列附近有哪些站），不用另外查即時資料。
const STOP_TTL_MS = 24 * 60 * 60 * 1000;

export async function getBusStops(cityCode: string): Promise<BusStop[]> {
  const rows = await tdxGet<TdxBusStopRow[]>(`/v2/Bus/Stop/City/${cityCode}?%24top=5000`, STOP_TTL_MS);

  // 同一個實體站牌常常被多條路線各自回傳一筆（StopUID 不同、但座標幾乎一樣），用座標
  // （取到小數 5 位，約 1 公尺精度）去重，不然地圖上同一個站牌會疊好幾個重複的點。
  const seen = new Set<string>();
  const result: BusStop[] = [];
  for (const r of rows) {
    const key = `${r.StopPosition.PositionLat.toFixed(5)},${r.StopPosition.PositionLon.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: r.StopUID, name: r.StopName.Zh_tw, lat: r.StopPosition.PositionLat, lng: r.StopPosition.PositionLon });
  }
  return result;
}
