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

/** 即時可借／可還車輛數——null 代表這一站查不到即時資料（TDX 沒回傳、或站點暫停營運），
 *  不要顯示成「0」，那會被誤會成「真的沒車」而不是「資料拿不到」。 */
export interface UbikeAvailability {
  availableRent: number;
  availableReturn: number;
}

export interface NearbyUbikeStation extends UbikeStation {
  cityName: string;
  distanceMeters: number;
  /** 只有「附近站點」這個查詢路徑才會帶這個欄位；依縣市瀏覽（getUbikeStations）故意
   *  不查即時資料，見下面 getUbikeStations 的說明。 */
  availability: UbikeAvailability | null;
}

// 只查站點本身（名稱、座標），不查即時可借/可還車輛數——這兩個是 TDX 分開的端點，站點
// 清單幾乎不會變，比照車站清單用 24 小時快取。依縣市瀏覽（整個縣市上百站）刻意不查即時
// 資料：使用者通常是在規劃階段瀏覽，不是站在路邊要立刻決定，而且一次秀上百站的車輛數
// 沒有意義，只有「附近站點」這種真的要馬上出發的情境才需要（見 getNearbyUbikeStations），
// 查詢量也小（最多 3 個縣市，不是逐站查），才不會額外吃掉太多 TDX 每分鐘 5 次的額度。
const STATION_TTL_MS = TDX_TTL.static;

interface TdxBikeAvailabilityRow {
  StationUID: string;
  AvailableRentBikes: number;
  AvailableReturnBikes: number;
  // TDX 服務狀態碼：1＝正常營運，非 1（暫停營運／數據異常等）都不該顯示車輛數——站點
  // 本身可能在維護、或資料本身不可信，顯示一個看起來正常的數字反而會誤導使用者過去了
  // 卻發現站點是壞的。
  ServiceStatus: number;
}

async function getUbikeAvailability(cityCode: string): Promise<Map<string, UbikeAvailability>> {
  const rows = await tdxGet<TdxBikeAvailabilityRow[]>(`/v2/Bike/Availability/City/${cityCode}`, TDX_TTL.realtime);
  const map = new Map<string, UbikeAvailability>();
  for (const r of rows) {
    if (r.ServiceStatus !== 1) continue;
    map.set(r.StationUID, { availableRent: r.AvailableRentBikes, availableReturn: r.AvailableReturnBikes });
  }
  return map;
}

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

/** 附近站點：排序、裁切都在伺服器端做完，前端只拿得到要顯示的那 limit 筆。
 *  只有這個查詢路徑會附上即時可借／可還車輛數——查詢範圍本來就已經被「附近」限制在
 *  最多 3 個縣市（見 nearbyCityNames），多查一個 Availability 端點不會讓額度消耗
 *  隨站點數或使用者數放大，跟查站點清單是同一個「整個縣市一次查完」的成本結構。 */
export async function getNearbyUbikeStations(lat: number, lng: number, limit: number): Promise<NearbyUbikeStation[]> {
  const cities = nearbyCityNames(lat, lng);
  const lists = await Promise.all(
    cities.map(async (city) => {
      try {
        const [stations, availability] = await Promise.all([
          getUbikeStations(UBIKE_CITY_CODE[city]),
          // 即時車輛數查失敗（例如剛好撞到額度上限）不該讓整個附近站點查詢跟著失敗——
          // 退回空 Map，畫面上這一批站點就是沒有車輛數可顯示，站點本身還是查得到。
          getUbikeAvailability(UBIKE_CITY_CODE[city]).catch(() => new Map<string, UbikeAvailability>()),
        ]);
        return stations.map((s) => ({
          ...s,
          cityName: city,
          distanceMeters: distanceMeters(lat, lng, s.lat, s.lng),
          availability: availability.get(s.id) ?? null,
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
