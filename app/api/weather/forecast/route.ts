import { NextResponse } from "next/server";
import { cwaGet } from "@/lib/cwa-client";

interface CwaTimeEntry {
  startTime: string;
  endTime: string;
  parameter: { parameterName: string; parameterValue?: string; parameterUnit?: string };
}

interface CwaLocation {
  locationName: string;
  weatherElement: { elementName: string; time: CwaTimeEntry[] }[];
}

interface CwaResponse {
  records: { location: CwaLocation[] };
}

// CWA 天氣現象代碼（Wx 的 parameterValue）：1-3 晴到晴時多雲、4-7 多雲到陰，8 以上都帶降雨／雷雨。
// 現在 UI 只有晴天／多雲／小雨三種圖示，先用代碼區間簡單分三類，之後要更細可以再補圖示。
function bucketFromWxCode(code: string): "sunny" | "cloudy" | "rain" {
  const n = Number(code);
  if (!Number.isFinite(n)) return "cloudy";
  if (n <= 3) return "sunny";
  if (n <= 7) return "cloudy";
  return "rain";
}

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city") ?? "";
  if (!city) {
    return NextResponse.json({ error: "缺少 city 參數" }, { status: 400 });
  }

  try {
    const data = await cwaGet<CwaResponse>(`/F-C0032-001?locationName=${encodeURIComponent(city)}`);
    const location = data.records.location[0];
    if (!location) {
      return NextResponse.json({ error: `查無「${city}」的天氣預報（locationName 要用完整縣市名，例如「臺北市」）` }, { status: 404 });
    }

    const findFirst = (name: string) => location.weatherElement.find((e) => e.elementName === name)?.time[0]?.parameter;
    const wx = findFirst("Wx");
    const maxT = findFirst("MaxT");
    const minT = findFirst("MinT");
    const pop = findFirst("PoP");

    const bucket = bucketFromWxCode(wx?.parameterValue ?? "");
    const temp = maxT?.parameterName ? Number(maxT.parameterName) : undefined;

    return NextResponse.json({
      bucket,
      label: wx?.parameterName ?? "未知",
      temp,
      tempLow: minT?.parameterName ? Number(minT.parameterName) : undefined,
      rainChance: pop?.parameterName ? Number(pop.parameterName) : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "CWA 查詢失敗" }, { status: 502 });
  }
}
