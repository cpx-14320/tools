import { tdxGet } from "@/lib/tdx-client";

// 站名 → TDX StationID 對照表。只先收錄這個工具實際用到的站，要加新站就查
// GET /api/basic/v3/Rail/TRA/Station（或 THSR/Metro 對應版本）找 StationID 補進來。
// 注意：台鐵站名用傳統字「臺」，高鐵站名用「台」，兩邊都收錄「台／臺」兩種寫法方便查表。

// 從 TDX /v2/Rail/THSR/Station 查回來的真實 12 站（苗栗／彰化／雲林是後來通車才加的，
// 不是最初的 8 站，之前這份表只收錄到左營那 7 站，查得到站碼的站才能查真實時刻表／票價）。
export const THSR_STATION_ID: Record<string, string> = {
  南港: "0990",
  台北: "1000",
  臺北: "1000",
  板橋: "1010",
  桃園: "1020",
  新竹: "1030",
  苗栗: "1035",
  台中: "1040",
  臺中: "1040",
  彰化: "1043",
  雲林: "1047",
  嘉義: "1050",
  台南: "1060",
  臺南: "1060",
  左營: "1070",
};

/** 公車站牌常用路線預設值：UI 目前只讓選站牌，這裡對應回該站牌主要查的路線名稱。 */
export const BUS_ROUTE_BY_STOP: Record<string, { city: string; routeName: string }> = {
  捷運象山站: { city: "Taipei", routeName: "信義幹線" },
};

export interface TraStation {
  id: string;
  name: string;
  city: string;
}

interface TraStationApiRow {
  StationID: string;
  StationName: { Zh_tw: string };
  StationAddress: string;
}

// 台鐵站址開頭是郵遞區號＋縣市名稱（例如 "320001桃園市中壢區..."），用這份縣市名單比對抓出縣市。
const CITY_NAMES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

function parseCity(address: string): string {
  const withoutZip = address.replace(/^\d+/, "");
  return CITY_NAMES.find((city) => withoutZip.startsWith(city)) ?? "其他";
}

// 車站清單幾乎不會變，快取 24 小時，不要讓這個每天都差不多的清單去佔每分鐘 5 次的額度。
const STATION_LIST_TTL_MS = 24 * 60 * 60 * 1000;

/** 台鐵全站清單，依 TDX 回傳順序（大致是沿線地理順序，北到南）排列。 */
export async function getTraStations(): Promise<TraStation[]> {
  const data = await tdxGet<{ Stations: TraStationApiRow[] }>("/v3/Rail/TRA/Station", STATION_LIST_TTL_MS);
  return data.Stations.map((s) => ({ id: s.StationID, name: s.StationName.Zh_tw, city: parseCity(s.StationAddress) }));
}

/** 依縣市分組的台鐵站清單，給「選縣市→選站」兩層下拉選單用。 */
export async function groupTraStationsByCity(): Promise<{ city: string; stations: { id: string; name: string }[] }[]> {
  const stations = await getTraStations();
  const byCity = new Map<string, { id: string; name: string }[]>();
  for (const s of stations) {
    const list = byCity.get(s.city) ?? [];
    list.push({ id: s.id, name: s.name });
    byCity.set(s.city, list);
  }
  return [...byCity.entries()].map(([city, cityStations]) => ({ city, stations: cityStations }));
}

export async function resolveTraStationId(name: string): Promise<string | undefined> {
  const stations = await getTraStations();
  return stations.find((s) => s.name === name)?.id;
}
