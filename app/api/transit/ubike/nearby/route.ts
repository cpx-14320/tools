import { NextResponse } from "next/server";
import { getNearbyUbikeStations } from "@/lib/transit/ubike";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

// 跟公車的 /bus/nearby-stops 完全同一套做法（粗篩縣市 → 合併 → 排序 → 裁切都在伺服器
// 端做完）：以前前端要對 11 個縣市各打一次 /ubike/stations 才能算出附近站點。
const NEARBY_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.round(limitParam), MAX_LIMIT) : NEARBY_LIMIT;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ stations: [], error: "缺少或不合法的 lat／lng 參數" }, { status: 400 });
  }

  try {
    const stations = await getNearbyUbikeStations(lat, lng, limit);
    return jsonCached({ stations }, API_CACHE.realtime);
  } catch (err) {
    return NextResponse.json(
      { stations: [], error: err instanceof Error ? err.message : "附近站點查詢失敗，請稍後再試" },
      { status: 502 },
    );
  }
}
