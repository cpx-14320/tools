import { NextResponse } from "next/server";
import { getRouteStops, BUS_CITY_CODE } from "@/lib/bus-routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const route = params.get("route") ?? "";
  const direction = params.get("direction") === "1" ? 1 : 0;

  if (!BUS_CITY_CODE[city] || !route) {
    return NextResponse.json({ stops: [], error: "缺少縣市或路線名稱" }, { status: 400 });
  }

  try {
    const stops = await getRouteStops(city, route, direction);
    return NextResponse.json({ stops });
  } catch (err) {
    return NextResponse.json({ stops: [], error: err instanceof Error ? err.message : "公車站序查詢失敗" }, { status: 502 });
  }
}
