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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const district = params.get("district") ?? "";
  if (!city || !district) {
    return NextResponse.json({ error: "缺少 city 或 district 參數" }, { status: 400 });
  }

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

    const findFirst = (name: string) => location.WeatherElement.find((e) => e.ElementName === name)?.Time[0]?.ElementValue[0];
    const temperature = findFirst("溫度");
    const weather = findFirst("天氣現象");
    // 鄉鎮天氣預報的降雨機率有些資料集是「3小時降雨機率」、有些是「12小時降雨機率」，
    // 兩種都試一次；查不到或當下時段沒有值（CWA 給 "-"）就不回傳這個欄位。
    const pop = findFirst("3小時降雨機率") ?? findFirst("12小時降雨機率");
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
