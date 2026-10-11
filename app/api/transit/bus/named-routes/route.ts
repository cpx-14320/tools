import { NextResponse } from "next/server";
import { getNamedBusRoutes, BUS_CITY_CODE } from "@/lib/transit/bus-routing";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";

  if (!BUS_CITY_CODE[city]) {
    return NextResponse.json({ routes: [], error: "缺少或不支援的縣市" }, { status: 400 });
  }

  try {
    const routes = await getNamedBusRoutes(city);
    return NextResponse.json({ routes });
  } catch (err) {
    return NextResponse.json({ routes: [], error: err instanceof Error ? err.message : "公車路線查詢失敗" }, { status: 502 });
  }
}
