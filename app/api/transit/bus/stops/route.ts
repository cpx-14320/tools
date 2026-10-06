import { NextResponse } from "next/server";
import { searchBusStops, BUS_CITY_CODE } from "@/lib/bus-routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const q = params.get("q") ?? "";

  if (!BUS_CITY_CODE[city]) {
    return NextResponse.json({ stops: [], error: "缺少或不支援的縣市" }, { status: 400 });
  }

  try {
    const stops = await searchBusStops(city, q);
    return NextResponse.json({ stops });
  } catch (err) {
    return NextResponse.json({ stops: [], error: err instanceof Error ? err.message : "公車站牌查詢失敗" }, { status: 502 });
  }
}
