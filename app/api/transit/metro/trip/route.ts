import { NextResponse } from "next/server";
import { computeMetroTrip } from "@/lib/metro-routing";
import { METRO_SYSTEM_CODE } from "@/lib/metro-lines";

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
    return NextResponse.json({ trip });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "捷運路線查詢失敗" }, { status: 502 });
  }
}
