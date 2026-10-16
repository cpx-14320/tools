import { tdxGet, TDX_TTL } from "./tdx-client";
import { distanceMeters } from "../geo";

// 中文縣市名稱對照 TDX 的英文城市代碼——逐一打過 /v2/Bike/Station/City/{code} 確認過真的
// 有站點資料才列進來（見 components/transit/ubike-cities.ts 的 UBIKE_CITIES，兩邊的
// 中文名稱要對得起來）。TDX 的微笑單車（YouBike2.0）服務範圍比公車查詢共用的 4 個縣市廣，
// 不要共用 lib/transit/bus-routing.ts 的 BUS_CITY_CODE，那份是刻意只收公車查詢支援的縣市。
export const UBIKE_CITY_CODE: Record<string, string> = {
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

// 各縣市大致中心點，用途跟 lib/transit/bus-routing.ts 的 BUS_CITY_CENTER 完全一樣：
// 「附近站點」先用這個粗篩出使用者附近的幾個縣市，只查那幾個縣市，不要 11 個縣市全查
// 一遍（TDX 每分鐘只有 5 次額度，11 個請求一次送出去註定有一半被擋）。半徑／上限也跟
// 公車那邊同一組數字，兩個「附近」功能的行為才一致。
const UBIKE_CITY_CENTER: Record<string, { lat: number; lng: number }> = {
  台北市: { lat: 25.0375, lng: 121.5637 },
  新北市: { lat: 25.0169, lng: 121.4628 },
  桃園市: { lat: 24.9937, lng: 121.2969 },
  基隆市: { lat: 25.1276, lng: 121.7392 },
  新竹市: { lat: 24.8138, lng: 120.9675 },
  新竹縣: { lat: 24.8276, lng: 121.0177 },
  苗栗縣: { lat: 24.5602, lng: 120.8214 },
  台中市: { lat: 24.1477, lng: 120.6736 },
  彰化縣: { lat: 24.0809, lng: 120.5386 },
  台南市: { lat: 22.9999, lng: 120.227 },
  高雄市: { lat: 22.6273, lng: 120.3014 },
};

const NEARBY_CITY_RADIUS_M = 45_000;
const NEARBY_CITY_LIMIT = 3;

interface TdxBikeStationRow {
  StationUID: string;
  StationName: { Zh_tw: string };
  StationPosition: { PositionLat: number; PositionLon: number };
}

export interface UbikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface NearbyUbikeStation extends UbikeStation {
  cityName: string;
  distanceMeters: number;
}

// 只查站點本身（名稱、座標），不查即時可借/可還車輛數——這兩個是 TDX 分開的端點，站點
// 清單幾乎不會變，比照車站清單用 24 小時快取；不查即時車輛數也省一份額度，之後真的要顯示
// 車輛數再另外加 /v2/Bike/Availability/City/{cityCode} 這個端點即可，不影響這裡的站點清單。
const STATION_TTL_MS = TDX_TTL.static;

export async function getUbikeStations(cityCode: string): Promise<UbikeStation[]> {
  const rows = await tdxGet<TdxBikeStationRow[]>(`/v2/Bike/Station/City/${cityCode}?%24top=1000`, STATION_TTL_MS);
  return rows.map((s) => ({
    id: s.StationUID,
    // TDX 回傳的站名實際上就是帶著「YouBike2.0_」這個官方品牌前綴，不是我們自己取的名字，
    // 這裡的 regex 要照 TDX 真實資料的字串比對，不能跟著畫面上顯示用的「Ubike」改掉。
    name: s.StationName.Zh_tw.replace(/^YouBike2?\.?0?_/, ""),
    lat: s.StationPosition.PositionLat,
    lng: s.StationPosition.PositionLon,
  }));
}

/** 使用者座標附近的縣市（依中心點距離粗篩），最多 NEARBY_CITY_LIMIT 個。 */
function nearbyCityNames(lat: number, lng: number): string[] {
  const ranked = Object.keys(UBIKE_CITY_CODE)
    .map((city) => {
      const center = UBIKE_CITY_CENTER[city];
      return { city, distance: center ? distanceMeters(lat, lng, center.lat, center.lng) : Number.POSITIVE_INFINITY };
    })
    .sort((a, b) => a.distance - b.distance);

  const within = ranked.filter((r) => r.distance <= NEARBY_CITY_RADIUS_M).slice(0, NEARBY_CITY_LIMIT);
  return (within.length > 0 ? within : ranked.slice(0, 1)).map((r) => r.city);
}

/** 附近站點：排序、裁切都在伺服器端做完，前端只拿得到要顯示的那 limit 筆。 */
export async function getNearbyUbikeStations(lat: number, lng: number, limit: number): Promise<NearbyUbikeStation[]> {
  const cities = nearbyCityNames(lat, lng);
  const lists = await Promise.all(
    cities.map(async (city) => {
      try {
        const stations = await getUbikeStations(UBIKE_CITY_CODE[city]);
        return stations.map((s) => ({
          ...s,
          cityName: city,
          distanceMeters: distanceMeters(lat, lng, s.lat, s.lng),
        }));
      } catch {
        // 某個縣市查失敗不要讓整個附近站點查詢跟著失敗（跟公車附近站牌同一個理由）。
        return [];
      }
    }),
  );

  return lists
    .flat()
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}
