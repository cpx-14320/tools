import { NextResponse } from "next/server";
import { getStopRoutes, BUS_CITY_CODE } from "@/lib/transit/bus-routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const stop = params.get("stop") ?? "";

  if (!BUS_CITY_CODE[city] || !stop) {
    return NextResponse.json({ routes: [], error: "缺少縣市或站牌名稱" }, { status: 400 });
  }

  try {
    const routes = await getStopRoutes(city, stop);
    return NextResponse.json({ routes });
  } catch (err) {
    return NextResponse.json({ routes: [], error: err instanceof Error ? err.message : "公車站牌查詢失敗" }, { status: 502 });
  }
}
