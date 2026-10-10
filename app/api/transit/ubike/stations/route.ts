import { NextResponse } from "next/server";
import { getUbikeStations, UBIKE_CITY_CODE } from "@/lib/transit/ubike";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const q = (params.get("q") ?? "").trim();

  const cityCode = UBIKE_CITY_CODE[city];
  if (!cityCode) {
    return NextResponse.json({ stations: [], error: "缺少或不支援的縣市" }, { status: 400 });
  }

  try {
    const stations = await getUbikeStations(cityCode);
    const filtered = (q ? stations.filter((s) => s.name.includes(q)) : stations).sort((a, b) =>
      a.name.localeCompare(b.name, "zh-Hant"),
    );
    return NextResponse.json({ stations: filtered });
  } catch (err) {
    return NextResponse.json({ stations: [], error: err instanceof Error ? err.message : "Ubike 站點查詢失敗" }, { status: 502 });
  }
}
