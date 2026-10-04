// 經緯度反查「在哪個縣市」用的簡易對照表——TDX 的 YouBike／公車站牌資料是依縣市查詢，
// 不能直接丟經緯度查「附近」，所以要先知道使用者在哪個縣市，才知道要打哪個 City 參數。
// 這裡故意不用真正的行政區邊界多邊形（維護成本高、這個功能也不需要精確到邊界那種程度），
// 只用各縣市概略中心點，抓「離哪個中心點最近」當作所在縣市，對「附近站點」這種用途夠準。
export interface CityCenter {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export const CITY_CENTERS: CityCenter[] = [
  { code: "Taipei", name: "臺北市", lat: 25.0478, lng: 121.5319 },
  { code: "NewTaipei", name: "新北市", lat: 25.0169, lng: 121.4628 },
  { code: "Taoyuan", name: "桃園市", lat: 24.9936, lng: 121.301 },
  { code: "Taichung", name: "臺中市", lat: 24.1477, lng: 120.6736 },
  { code: "Tainan", name: "臺南市", lat: 22.9999, lng: 120.2269 },
  { code: "Kaohsiung", name: "高雄市", lat: 22.6273, lng: 120.3014 },
  { code: "Keelung", name: "基隆市", lat: 25.1276, lng: 121.7392 },
  { code: "HsinchuCity", name: "新竹市", lat: 24.8138, lng: 120.9675 },
  { code: "HsinchuCounty", name: "新竹縣", lat: 24.8387, lng: 121.0177 },
  { code: "MiaoliCounty", name: "苗栗縣", lat: 24.5602, lng: 120.8214 },
  { code: "ChanghuaCounty", name: "彰化縣", lat: 24.0518, lng: 120.5161 },
  { code: "NantouCounty", name: "南投縣", lat: 23.9609, lng: 120.9718 },
  { code: "YunlinCounty", name: "雲林縣", lat: 23.7092, lng: 120.4313 },
  { code: "ChiayiCounty", name: "嘉義縣", lat: 23.4518, lng: 120.2555 },
  { code: "ChiayiCity", name: "嘉義市", lat: 23.4801, lng: 120.4491 },
  { code: "PingtungCounty", name: "屏東縣", lat: 22.5519, lng: 120.5487 },
  { code: "YilanCounty", name: "宜蘭縣", lat: 24.7021, lng: 121.7378 },
  { code: "HualienCounty", name: "花蓮縣", lat: 23.9871, lng: 121.6015 },
  { code: "TaitungCounty", name: "臺東縣", lat: 22.7583, lng: 121.1444 },
  { code: "PenghuCounty", name: "澎湖縣", lat: 23.5711, lng: 119.5793 },
  { code: "KinmenCounty", name: "金門縣", lat: 24.4491, lng: 118.3767 },
  { code: "LienchiangCounty", name: "連江縣", lat: 26.1608, lng: 119.9499 },
];

/** 用平面近似（不是真正的球面距離）挑最近的縣市中心點就夠了，這裡只是要決定打 TDX
 *  的 City 參數，不是要算精確距離。 */
export function nearestCity(lat: number, lng: number): CityCenter {
  let best = CITY_CENTERS[0];
  let bestDist = Infinity;
  for (const c of CITY_CENTERS) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// 算兩個經緯度之間的實際距離（公尺），用來把「同一縣市的站點清單」依照離使用者遠近排序、
// 篩選「附近」——這裡才需要真正準確的距離，用 Haversine 公式。
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
