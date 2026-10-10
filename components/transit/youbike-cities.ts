/** YouBike 查詢可選的縣市清單——跟公車共用的 4 個縣市（見 stations-data.ts 的
 *  STATIONS_BY_CITY.bus）不夠用，YouBike2.0 實際服務範圍廣得多。這份清單是直接拿 TDX
 *  的 /v2/Bike/Station/City/{city} 逐一測過、確認真的有站點資料才列進來，不是憑印象
 *  寫死；縣市代碼對照（中文名 → TDX 英文代碼）在伺服器端的 lib/transit/youbike.ts 裡，
 *  這裡只放要顯示在畫面上的中文縣市名稱。 */
export const YOUBIKE_CITIES = ["台北市", "新北市", "桃園市", "基隆市", "新竹市", "新竹縣", "苗栗縣", "台中市", "彰化縣", "台南市", "高雄市"];
