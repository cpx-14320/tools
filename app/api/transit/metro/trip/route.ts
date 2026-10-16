import { NextResponse } from "next/server";
import { computeMetroTrip } from "@/lib/transit/metro-routing";
import { METRO_SYSTEM_CODE } from "@/lib/transit/metro-lines";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

// 只處理「出發、抵達在同一個捷運系統」的查詢——跨系統（台北／新北／桃園機場捷運互通的
// 那三個）沒有統一的票價／行車時間資料，前端改用 findCrossSystemTransferStation 純比對
// 站名，不用打這個 API。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const system = params.get("system") ?? "";
  const origin = params.get("origin") ?? "";
  const dest = params.get("dest") ?? "";
  const systemCode = METRO_SYSTEM_CODE[system];
  if (!systemCode || !origin || !dest) {
    return NextResponse.json({ error: "缺少 system／origin／dest，或不是支援的捷運系統" }, { status: 400 });
  }

  try {
    const trip = await computeMetroTrip(systemCode, origin, dest);
    // 捷運的車程時間／站數／票價是算出來的靜態資料（沒有即時班次），同一組起訖站的結果
    // 一天內不會變，讓瀏覽器直接快取——使用者在結果頁跟首頁之間來回時不用重算。
    return jsonCached({ trip }, API_CACHE.static);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "捷運路線查詢失敗，請稍後再試" }, { status: 502 });
  }
}
