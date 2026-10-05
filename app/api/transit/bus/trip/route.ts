import { NextResponse } from "next/server";
import { findBusRoutes, BUS_CITY_CODE } from "@/lib/bus-routing";
import { nowHHmmInTaipei } from "@/lib/tdx-time";

// 公車沒有時刻表，只有「現在幾分鐘後到站」的即時預估，所以跟火車／高鐵／捷運不一樣：
// 查不到「未來某個時間點」的班次，永遠只能回答「現在」這個時間點的狀態。沒有真實的站間
// 行車時間資料，車程時間／抵達時間用「每站約 2 分鐘」概估，不是真的查到的數字。
const MINUTES_PER_STOP_ESTIMATE = 2;

function addMinutesToHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const originCity = params.get("originCity") ?? "";
  const origin = params.get("origin") ?? "";
  const destCity = params.get("destCity") ?? "";
  const dest = params.get("dest") ?? "";

  if (!BUS_CITY_CODE[originCity] || !BUS_CITY_CODE[destCity] || !origin || !dest) {
    return NextResponse.json({ rows: [], error: "缺少出發／抵達站的縣市或站名" }, { status: 400 });
  }

  try {
    const matches = await findBusRoutes(originCity, origin, destCity, dest);
    const nowTime = nowHHmmInTaipei();

    // 沒有可信預估值（末班已過、尚未發車、資料缺漏）的路線不顯示，顯示出來的都是「現在
    // 真的查得到幾分鐘後到站」的路線。
    const rows = matches
      .filter((m): m is typeof m & { etaMinutes: number } => m.etaMinutes !== null)
      .map((m) => {
        const time = addMinutesToHHMM(nowTime, m.etaMinutes);
        const travelMinutes = m.stops * MINUTES_PER_STOP_ESTIMATE;
        return {
          time,
          arrive: addMinutesToHHMM(time, travelMinutes),
          code: m.routeName,
          duration: `約 ${travelMinutes} 分`,
          stops: m.stops,
          isPast: false,
        };
      });

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "公車路線查詢失敗" }, { status: 502 });
  }
}
