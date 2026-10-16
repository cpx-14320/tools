import { NextResponse } from "next/server";
import { cwaGet } from "@/lib/transit/cwa-client";
import { DISTRICT_DATASET_ID } from "@/lib/transit/cwa-districts";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

interface CwaElementValue {
  Temperature?: string;
  Weather?: string;
  WeatherCode?: string;
  ProbabilityOfPrecipitation?: string;
}

interface CwaTimeEntry {
  DataTime?: string;
  StartTime?: string;
  EndTime?: string;
  ElementValue: CwaElementValue[];
}

interface CwaWeatherElement {
  ElementName: string;
  Time: CwaTimeEntry[];
}

interface CwaDistrictLocation {
  LocationName: string;
  WeatherElement: CwaWeatherElement[];
}

interface CwaResponse {
  records: { Locations: { Location: CwaDistrictLocation[] }[] };
}

/** 首頁天氣輪播固定就是「今天／明天」兩張卡，不是讓呼叫端自己決定哪幾天。 */
const DAY_OFFSETS = [0, 1] as const;

/** 一次最多查幾個地區——使用者可以在首頁設定裡自由新增區塊，但一次請求總得有上限。 */
const MAX_BLOCKS = 8;

// CWA 天氣現象代碼：1-3 晴到晴時多雲、4-7 多雲到陰，8 以上都帶降雨／雷雨。
// 現在 UI 只有晴天／多雲／小雨三種圖示，先用代碼區間簡單分三類，之後要更細可以再補圖示。
function bucketFromWxCode(code: string): "sunny" | "cloudy" | "rain" {
  const n = Number(code);
  if (!Number.isFinite(n)) return "cloudy";
  if (n <= 3) return "sunny";
  if (n <= 7) return "cloudy";
  return "rain";
}

// 算「今天／明天」在台灣當地的日期字串，不能依賴伺服器所在時區（Vercel 預設是 UTC）：
// 直接拿目前 UTC 時間加 8 小時當作台灣當地時間去算年月日。
function taipeiDateString(offsetDays: number): string {
  const taipeiMs = Date.now() + 8 * 60 * 60 * 1000;
  const d = new Date(taipeiMs);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 鄉鎮天氣預報的 Time[] 是連續好幾個時段（3 或 12 小時一段，往後蓋約 2～3 天）。
// 「今天」要挑「現在所在的那個時段」，不是當天的第一個時段——不然晚上 8 點看到的會是
// 今天凌晨那一段的溫度跟天氣，跟現在差很多。「明天」沒有「現在」可言，挑當天第一段。
// 兩種情況都找不到（例如要求的天數超出預報範圍）就退回第一筆，至少還能顯示點東西。
function pickTimeEntry(times: CwaTimeEntry[] | undefined, targetDate: string, isToday: boolean): CwaTimeEntry | undefined {
  if (!times || times.length === 0) return undefined;
  const sameDay = times.filter((t) => (t.StartTime ?? t.DataTime ?? "").slice(0, 10) === targetDate);
  if (isToday) {
    const nowIso = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);
    const current = sameDay.find((t) => (t.EndTime ?? t.DataTime ?? "").slice(0, 19) >= nowIso);
    if (current) return current;
  }
  return sameDay[0] ?? times[0];
}

interface DayForecast {
  dayOffset: number;
  bucket?: "sunny" | "cloudy" | "rain";
  label?: string;
  temp?: number;
  pop?: number;
}

function readDay(location: CwaDistrictLocation, dayOffset: number): DayForecast {
  const targetDate = taipeiDateString(dayOffset);
  const findSlot = (name: string) =>
    pickTimeEntry(location.WeatherElement.find((e) => e.ElementName === name)?.Time, targetDate, dayOffset === 0)?.ElementValue[0];
  const temperature = findSlot("溫度");
  const weather = findSlot("天氣現象");
  // 鄉鎮天氣預報的降雨機率有些資料集是「3小時降雨機率」、有些是「12小時降雨機率」，
  // 兩種都試一次；查不到或當下時段沒有值（CWA 給 "-"）就不回傳這個欄位。
  const pop = findSlot("3小時降雨機率") ?? findSlot("12小時降雨機率");
  const popValue = pop?.ProbabilityOfPrecipitation;
  const popNumber = popValue && popValue !== "-" ? Number(popValue) : undefined;

  return {
    dayOffset,
    bucket: bucketFromWxCode(weather?.WeatherCode ?? ""),
    label: weather?.Weather ?? "未知",
    temp: temperature?.Temperature ? Number(temperature.Temperature) : undefined,
    pop: popNumber !== undefined && Number.isFinite(popNumber) ? popNumber : undefined,
  };
}

interface BlockForecast {
  city: string;
  district: string;
  days: DayForecast[];
  error?: string;
}

async function forecastForBlock(city: string, district: string): Promise<BlockForecast> {
  const datasetId = DISTRICT_DATASET_ID[city];
  if (!datasetId) return { city, district, days: [], error: `查無「${city}」對應的鄉鎮天氣預報資料集` };

  try {
    const data = await cwaGet<CwaResponse>(`/${datasetId}?LocationName=${encodeURIComponent(district)}`);
    const location = data.records.Locations[0]?.Location[0];
    if (!location) return { city, district, days: [], error: `查無「${city}${district}」的天氣預報` };
    return { city, district, days: DAY_OFFSETS.map((dayOffset) => readDay(location, dayOffset)) };
  } catch (err) {
    return { city, district, days: [], error: err instanceof Error ? err.message : "天氣查詢失敗，請稍後再試" };
  }
}

/**
 * 首頁天氣卡的預報資料。
 *
 * `?blocks=桃園市|中壢區,臺北市|南港區` —— 一次把首頁所有天氣區塊、今天＋明天兩天的
 * 預報全部回傳。以前是每一張卡各自打一次（2 個區塊 × 2 天 ＝ 4 個請求），而「今天」跟
 * 「明天」本來就在同一包 CWA 回應裡，同一個地區拆成兩次請求完全是白跑的；區塊數量還是
 * 使用者自己決定的，區塊一多（4 個區塊就 8 個請求）首頁一載入就是一排請求。
 *
 * 同一個地區在清單裡重複出現時只查一次（下面的 seen 去重）。
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("blocks") ?? "";
  const seen = new Set<string>();
  const requested: { city: string; district: string }[] = [];
  for (const entry of raw.split(",")) {
    const [city, district] = entry.split("|").map((s) => s.trim());
    if (!city || !district) continue;
    const key = `${city}|${district}`;
    if (seen.has(key)) continue;
    seen.add(key);
    requested.push({ city, district });
    if (requested.length >= MAX_BLOCKS) break;
  }

  if (requested.length === 0) {
    return NextResponse.json({ blocks: [], error: "缺少 blocks 參數（格式：縣市|行政區，用逗號分隔）" }, { status: 400 });
  }

  const blocks = await Promise.all(requested.map((b) => forecastForBlock(b.city, b.district)));
  // 單一地區查失敗時整包還是 200，失敗的那一個區塊自己帶 error——其他地區查得到的資料
  // 不該被一個失敗的地區拖著一起消失。
  return jsonCached({ blocks }, API_CACHE.weather);
}
