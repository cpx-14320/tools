import { METRO_STATIONS_BY_CITY, METRO_CROSS_CITY_GROUP } from "@/lib/metro-lines";

// 公車／高鐵目前沒有像台鐵一樣的「全站動態清單」API 可用（高鐵僅 7 站、用固定表；
// 公車 TDX 是以路線＋站牌查詢，沒有「起訖站」兩點查詢模型），所以這兩種車種先用
// 靜態縣市清單；火車另外在用到的地方改抓 /api/transit/tra/stations 的真實站名清單；
// 捷運改用 lib/metro-lines.ts 的真實站點清單，左欄是「捷運系統」不是縣市（見下方 metro 欄位）。
export type Mode = "train" | "thsr" | "bus" | "metro";

// 城市/站名用字要跟 lib/tdx-stations.ts 解析真實站名清單時用的字一致（台鐵站名用「臺」不是
// 「台」、站名本身不帶「站」字），否則等真實清單載入把這份墊檔換掉後，原本選的縣市 key 會
// 對不到新清單、畫面會直接整個壞掉（undefined.map 當掉）。
export const FALLBACK_TRAIN_STATIONS_BY_CITY: Record<string, string[]> = {
  臺北市: ["臺北", "松山"],
  新北市: ["板橋", "樹林"],
  桃園市: ["桃園", "中壢"],
  新竹市: ["新竹"],
  臺中市: ["臺中"],
  臺南市: ["臺南"],
  高雄市: ["高雄", "左營"],
  花蓮縣: ["花蓮"],
};

export const STATIONS_BY_CITY: Record<Mode, Record<string, string[]>> = {
  train: FALLBACK_TRAIN_STATIONS_BY_CITY,
  // 高鐵實際現在有 12 站（苗栗／彰化／雲林是後來通車才加的），不是最早通車時的 8 站，
  // 跟 lib/tdx-stations.ts 的 THSR_STATION_ID 對照表一起更新，不然新站查不到站碼。
  thsr: {
    台北市: ["南港站", "台北站"],
    新北市: ["板橋站"],
    桃園市: ["桃園站"],
    新竹市: ["新竹站"],
    苗栗縣: ["苗栗站"],
    台中市: ["台中站"],
    彰化縣: ["彰化站"],
    雲林縣: ["雲林站"],
    嘉義縣: ["嘉義站"],
    台南市: ["台南站"],
    高雄市: ["左營站"],
  },
  // 原本「台北轉運站」「市府轉運站」是編出來的假站名，TDX 的公車站牌資料裡根本查不到，
  // 已經換成實際查過真的存在的站牌名稱（跟 lib/bus-routing.ts 的 BUS_CITY_CODE 對照表
  // 一起更新）。
  bus: {
    台北市: ["市政府(市府)", "捷運公館站"],
    新北市: ["新北板橋公車站", "捷運新莊站(新莊郵局)"],
    桃園市: ["中壢客運中壢總站", "復興中正路口(桃園火車站)"],
    基隆市: ["基隆市政府"],
  },
  // 左欄的 key 是「捷運系統」（台北捷運／新北捷運／淡海輕軌／桃園機場捷運／台中捷運／
  // 高雄捷運／高雄輕軌）不是縣市——捷運路線常常橫跨好幾個縣市，用系統名稱反而比單一縣市
  // 準確；右欄站名已經帶好路線代碼＋站碼（例如「BL07板橋」），兩層選單的 UI 跟火車／公車
  // 共用同一套（StationPickerModal），不用另外改元件。
  metro: METRO_STATIONS_BY_CITY,
};

// 捷運抵達站可以選的系統範圍：出發站選到有互通轉乘的系統（台北／新北／桃園機場捷運）時，
// 抵達站也能在這三個系統裡挑；出發站選到其他獨立系統（淡海輕軌／台中／高雄捷運／高雄輕軌）
// 時，抵達站只能跟出發站同一個系統，不給跳系統選——公車／火車／高鐵不受這個限制，維持
// 原本可以跨縣市選的行為。首頁搜尋表單跟我的行程新增常用行程共用這個邏輯，不要各自重寫
// 一份、改規則時兩邊會對不起來。
export function destCitiesFor(mode: Mode, originCity: string, cities: Record<string, string[]>): Record<string, string[]> {
  if (mode !== "metro") return cities;
  if (METRO_CROSS_CITY_GROUP.includes(originCity)) {
    return Object.fromEntries(METRO_CROSS_CITY_GROUP.filter((c) => cities[c]).map((c) => [c, cities[c]]));
  }
  return cities[originCity] ? { [originCity]: cities[originCity] } : cities;
}
