import { NextResponse } from "next/server";
import { getNamedBusRoutes, BUS_CITY_CODE } from "@/lib/transit/bus-routing";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";

  if (!BUS_CITY_CODE[city]) {
    return NextResponse.json({ routes: [], error: "缺少或不支援的縣市" }, { status: 400 });
  }

  try {
    const routes = await getNamedBusRoutes(city);
    // 文字命名路線清單幾乎不會變，跟車站清單同一級的快取時間：同一個縣市的清單不管使用者
    // 反覆打開幾次「瀏覽文字命名路線」，一天內瀏覽器都只會真的請求一次。
    return jsonCached({ routes }, API_CACHE.static);
  } catch (err) {
    return NextResponse.json({ routes: [], error: err instanceof Error ? err.message : "公車路線查詢失敗，請稍後再試" }, { status: 502 });
  }
}
