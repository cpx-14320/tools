import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/tdx-client";
import { getTraStations } from "@/lib/tdx-stations";
import { todayInTaipei, nowHHmmInTaipei, minutesBetween, formatDuration } from "@/lib/tdx-time";

interface StopTime {
  StationID: string;
  StopSequence: number;
  ArrivalTime: string;
  DepartureTime: string;
}

interface TrainTimetableEntry {
  TrainInfo: { TrainNo: string; TrainTypeName: { Zh_tw: string } };
  StopTimes: StopTime[];
}

interface StationLiveBoardRow {
  TrainNo: string;
  DelayTime: number;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = params.get("origin") ?? "";
  const dest = params.get("dest") ?? "";
  const date = params.get("date") || todayInTaipei();
  const time = params.get("time") || nowHHmmInTaipei();

  try {
    const stations = await getTraStations();
    const originId = stations.find((s) => s.name === origin)?.id;
    const destId = stations.find((s) => s.name === dest)?.id;
    if (!originId || !destId) {
      return NextResponse.json({ rows: [], error: `沒有「${origin}」或「${dest}」的台鐵站碼對照` }, { status: 400 });
    }

    const [timetable, liveBoard] = await Promise.allSettled([
      tdxGet<{ TrainTimetables: TrainTimetableEntry[] }>(`/v3/Rail/TRA/DailyTrainTimetable/OD/${originId}/to/${destId}/${date}`),
      tdxGet<{ StationLiveBoards: StationLiveBoardRow[] }>(`/v3/Rail/TRA/StationLiveBoard/Station/${originId}`),
    ]);

    if (timetable.status === "rejected") throw timetable.reason;

    const delayByTrainNo = new Map<string, number>();
    if (liveBoard.status === "fulfilled") {
      for (const b of liveBoard.value.StationLiveBoards) delayByTrainNo.set(b.TrainNo, b.DelayTime);
    }

    const rows = timetable.value.TrainTimetables.map((t) => {
      const originStop = t.StopTimes.find((s) => s.StationID === originId);
      const destStop = t.StopTimes.find((s) => s.StationID === destId);
      if (!originStop || !destStop) return null;
      const depTime = originStop.DepartureTime.slice(0, 5);
      const arrival = destStop.ArrivalTime.slice(0, 5);
      const stopCount = destStop.StopSequence - originStop.StopSequence + 1;
      return {
        time: depTime,
        code: `${t.TrainInfo.TrainTypeName.Zh_tw} ${t.TrainInfo.TrainNo} 次`,
        destName: dest,
        note: `抵達 ${arrival}・車程 ${formatDuration(minutesBetween(depTime, arrival))}・停靠 ${stopCount} 站`,
        delayMinutes: delayByTrainNo.get(t.TrainInfo.TrainNo),
        isPast: depTime < time,
      };
    })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
