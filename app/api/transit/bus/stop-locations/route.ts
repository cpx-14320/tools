import { NextResponse } from "next/server";
import { getCityBusStopLocations, BUS_CITY_CODE } from "@/lib/transit/bus-routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";

  if (!BUS_CITY_CODE[city]) {
    return NextResponse.json({ stops: [], error: "缺少或不支援的縣市" }, { status: 400 });
  }

  try {
    const stops = await getCityBusStopLocations(city);
    return NextResponse.json({ stops });
  } catch (err) {
    return NextResponse.json({ stops: [], error: err instanceof Error ? err.message : "公車站牌查詢失敗" }, { status: 502 });
  }
}
