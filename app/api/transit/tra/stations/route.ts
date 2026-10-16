import { NextResponse } from "next/server";
import { groupTraStationsByCity } from "@/lib/transit/tdx-stations";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

export async function GET() {
  try {
    const cities = await groupTraStationsByCity();
    // 全台約 240 站的清單，首頁掛載、常用行程編輯彈窗、搜尋結果頁「加入行程」都會用到，
    // 一天內瀏覽器只會真的請求一次（伺服器端的 TDX 快取也是 24 小時）。
    return jsonCached({ cities }, API_CACHE.static);
  } catch (err) {
    return NextResponse.json({ cities: [], error: err instanceof Error ? err.message : "台鐵車站查詢失敗，請稍後再試" }, { status: 502 });
  }
}
