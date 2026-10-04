import { METRO_STATIONS_BY_LINE } from "@/lib/metro-lines";

// 公車／高鐵目前沒有像台鐵一樣的「全站動態清單」API 可用（高鐵僅 7 站、用固定表；
// 公車 TDX 是以路線＋站牌查詢，沒有「起訖站」兩點查詢模型），所以這兩種車種先用
// 靜態縣市清單；火車另外在用到的地方改抓 /api/transit/tra/stations 的真實站名清單；
// 捷運改用 lib/metro-lines.ts 的真實台北捷運站點（見下方 metro 欄位）。
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
  thsr: {
    台北市: ["南港站", "台北站"],
    新北市: ["板橋站"],
    桃園市: ["桃園站"],
    新竹市: ["新竹站"],
    台中市: ["台中站"],
    高雄市: ["左營站"],
  },
  bus: {
    台北市: ["台北轉運站", "市府轉運站"],
    新北市: ["板橋站", "新莊站"],
    桃園市: ["中壢站", "桃園站"],
    基隆市: ["基隆站"],
  },
  // 左欄的 key 本質是「路線」不是縣市，右欄站名也已經帶好站碼（例如「BL07 板橋」），
  // 兩層選單的 UI 跟火車／公車共用同一套（CityStationPicker／StationPickerModal），
  // 顯示文字直接就是「路線代碼 路線名稱」＋「站碼 站名」，不用另外改元件。
  metro: METRO_STATIONS_BY_LINE,
};
