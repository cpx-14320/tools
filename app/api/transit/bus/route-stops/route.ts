import { NextResponse } from "next/server";
import { getRouteStops, BUS_CITY_CODE } from "@/lib/transit/bus-routing";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = params.get("city") ?? "";
  const route = params.get("route") ?? "";

  if (!BUS_CITY_CODE[city] || !route) {
    return NextResponse.json({ stops: { 0: [], 1: [] }, error: "缺少縣市或路線名稱" }, { status: 400 });
  }

  try {
    const stops = await getRouteStops(city, route);
    // 回應裡帶即時到站時間，只放 30 秒——但這 30 秒剛好蓋住「在選擇彈窗看完站序、按下去
    // 進結果頁又查同一條路線」這個最常見的重複請求。
    return jsonCached({ stops }, API_CACHE.realtime);
  } catch (err) {
    return NextResponse.json({ stops: { 0: [], 1: [] }, error: err instanceof Error ? err.message : "公車站序查詢失敗，請稍後再試" }, { status: 502 });
  }
}
