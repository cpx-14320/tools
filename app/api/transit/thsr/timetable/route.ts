import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/tdx-client";
import { THSR_STATION_ID } from "@/lib/tdx-stations";
import { todayInTaipei, nowHHmmInTaipei, minutesBetween, formatDuration } from "@/lib/tdx-time";

interface DailyTimetableRow {
  DailyTrainInfo: { TrainNo: string };
  OriginStopTime: { StopSequence: number; DepartureTime: string };
  DestinationStopTime: { StopSequence: number; ArrivalTime: string };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = params.get("origin") ?? "";
  const dest = params.get("dest") ?? "";
  const date = params.get("date") || todayInTaipei();
  const time = params.get("time") || nowHHmmInTaipei();

  const originId = THSR_STATION_ID[origin];
  const destId = THSR_STATION_ID[dest];
  if (!originId || !destId) {
    return NextResponse.json({ rows: [], error: `沒有「${origin}」或「${dest}」的高鐵站碼對照` }, { status: 400 });
  }

  try {
    const data = await tdxGet<DailyTimetableRow[]>(`/v2/Rail/THSR/DailyTimetable/OD/${originId}/to/${destId}/${date}`);

    const rows = data.map((t) => {
      const dep = t.OriginStopTime.DepartureTime;
      const arr = t.DestinationStopTime.ArrivalTime;
      const stopCount = t.DestinationStopTime.StopSequence - t.OriginStopTime.StopSequence + 1;
      return {
        time: dep,
        code: `${t.DailyTrainInfo.TrainNo} 次`,
        destName: dest,
        note: `抵達 ${arr}・車程 ${formatDuration(minutesBetween(dep, arr))}・停靠 ${stopCount} 站`,
        isPast: dep < time,
      };
    });
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
