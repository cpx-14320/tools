import { NextResponse } from "next/server";
import { getUbikeStations, UBIKE_CITY_CODE } from "@/lib/transit/ubike";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

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
    // 站點清單幾乎不會變：同一個縣市（含打字篩選的每個關鍵字）一天內瀏覽器只會真的請求
    // 一次，使用者在縣市之間來回切換不會重複打。
    return jsonCached({ stations: filtered }, API_CACHE.static);
  } catch (err) {
    return NextResponse.json({ stations: [], error: err instanceof Error ? err.message : "Ubike 站點查詢失敗，請稍後再試" }, { status: 502 });
  }
}
