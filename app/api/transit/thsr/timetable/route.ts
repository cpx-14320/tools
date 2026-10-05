import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/tdx-client";
import { THSR_STATION_ID } from "@/lib/tdx-stations";
import { todayInTaipei, nowHHmmInTaipei, minutesBetween, formatDuration } from "@/lib/tdx-time";

interface DailyTimetableRow {
  DailyTrainInfo: { TrainNo: string };
  OriginStopTime: { StopSequence: number; DepartureTime: string };
  DestinationStopTime: { StopSequence: number; ArrivalTime: string };
}

interface OdFareEntry {
  Fares: { TicketType: number; FareClass: number; CabinClass: number; Price: number }[];
}

// TicketType 1＝單程票、FareClass 1＝普通票（全票）、CabinClass 1＝標準車廂（一般旅客平常
// 看到的票價，不是商務艙）。
function standardFullFareOf(entry: OdFareEntry): number | undefined {
  return entry.Fares.find((f) => f.TicketType === 1 && f.FareClass === 1 && f.CabinClass === 1)?.Price;
}

// 站名顯示字串帶「站」字尾（例如「台北站」，跟 STATIONS_BY_CITY.thsr 的格式一致），THSR_STATION_ID
// 對照表的 key 不帶「站」，查之前先去掉。
function stripStationSuffix(station: string): string {
  return station.endsWith("站") ? station.slice(0, -1) : station;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = stripStationSuffix(params.get("origin") ?? "");
  const dest = stripStationSuffix(params.get("dest") ?? "");
  const today = todayInTaipei();
  const date = params.get("date") || today;
  // 跟台鐵同一套道理：「已過期」要跟真實的現在時間比，不能用使用者選的搜尋時間。
  const nowTime = nowHHmmInTaipei();

  const originId = THSR_STATION_ID[origin];
  const destId = THSR_STATION_ID[dest];
  if (!originId || !destId) {
    return NextResponse.json({ rows: [], error: `沒有「${origin}」或「${dest}」的高鐵站碼對照` }, { status: 400 });
  }

  try {
    const [timetable, fareEntries] = await Promise.allSettled([
      tdxGet<DailyTimetableRow[]>(`/v2/Rail/THSR/DailyTimetable/OD/${originId}/to/${destId}/${date}`),
      tdxGet<OdFareEntry[]>(`/v2/Rail/THSR/ODFare/${originId}/to/${destId}`, 24 * 60 * 60 * 1000),
    ]);

    if (timetable.status === "rejected") throw timetable.reason;
    const fullFare = fareEntries.status === "fulfilled" ? standardFullFareOf(fareEntries.value[0]) : undefined;

    const rows = timetable.value.map((t) => {
      const depTime = t.OriginStopTime.DepartureTime.slice(0, 5);
      const arrival = t.DestinationStopTime.ArrivalTime.slice(0, 5);
      const stopCount = t.DestinationStopTime.StopSequence - t.OriginStopTime.StopSequence + 1;
      return {
        time: depTime,
        arrive: arrival,
        duration: formatDuration(minutesBetween(depTime, arrival)),
        stops: stopCount,
        code: t.DailyTrainInfo.TrainNo,
        price: fullFare !== undefined ? `NT$ ${fullFare}` : undefined,
        isPast: date < today || (date === today && depTime < nowTime),
      };
    });

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "高鐵時刻查詢失敗" }, { status: 502 });
  }
}
