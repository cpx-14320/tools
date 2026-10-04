import { NextResponse } from "next/server";
import { cwaGet } from "@/lib/cwa-client";
import { DISTRICT_DATASET_ID } from "@/lib/cwa-districts";

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

// 鄉鎮天氣預報的 Time[] 是連續好幾個時段（3 或 12 小時一段，往後蓋約 2～3 天），依
// StartTime 的日期找出「目標那一天」第一個時段；找不到（例如要求的天數超出預報範圍）
// 就退回第一筆，至少還能顯示點東西，不要整個壞掉。
function pickTimeEntry(times: CwaTimeEntry[] | undefined, targetDate: string): CwaTimeEntry | undefined {
  if (!times || times.length === 0) return undefined;
  return times.find((t) => (t.StartTime ?? t.DataTime ?? "").slice(0, 10) === targetDate) ?? times[0];
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const district = params.get("district") ?? "";
  if (!city || !district) {
    return NextResponse.json({ error: "缺少 city 或 district 參數" }, { status: 400 });
  }
  // dayOffset 0＝今天、1＝明天，讓同一個縣市可以同時存在「今天」「明天」兩筆天氣卡輪播。
  const dayOffsetParam = Number(params.get("dayOffset") ?? "0");
  const dayOffset = Number.isFinite(dayOffsetParam) ? Math.max(0, Math.round(dayOffsetParam)) : 0;
  const targetDate = taipeiDateString(dayOffset);

  const datasetId = DISTRICT_DATASET_ID[city];
  if (!datasetId) {
    return NextResponse.json({ error: `查無「${city}」對應的鄉鎮天氣預報資料集` }, { status: 400 });
  }

  try {
    const data = await cwaGet<CwaResponse>(`/${datasetId}?LocationName=${encodeURIComponent(district)}`);
    const location = data.records.Locations[0]?.Location[0];
    if (!location) {
      return NextResponse.json({ error: `查無「${city}${district}」的天氣預報` }, { status: 404 });
    }

    const findSlot = (name: string) => pickTimeEntry(location.WeatherElement.find((e) => e.ElementName === name)?.Time, targetDate)?.ElementValue[0];
    const temperature = findSlot("溫度");
    const weather = findSlot("天氣現象");
    // 鄉鎮天氣預報的降雨機率有些資料集是「3小時降雨機率」、有些是「12小時降雨機率」，
    // 兩種都試一次；查不到或當下時段沒有值（CWA 給 "-"）就不回傳這個欄位。
    const pop = findSlot("3小時降雨機率") ?? findSlot("12小時降雨機率");
    const popValue = pop?.ProbabilityOfPrecipitation;
    const popNumber = popValue && popValue !== "-" ? Number(popValue) : undefined;

    const bucket = bucketFromWxCode(weather?.WeatherCode ?? "");

    return NextResponse.json({
      bucket,
      label: weather?.Weather ?? "未知",
      temp: temperature?.Temperature ? Number(temperature.Temperature) : undefined,
      pop: popNumber !== undefined && Number.isFinite(popNumber) ? popNumber : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "CWA 查詢失敗" }, { status: 502 });
  }
}
