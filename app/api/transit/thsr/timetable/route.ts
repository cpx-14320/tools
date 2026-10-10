import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/transit/tdx-client";
import { THSR_STATION_ID } from "@/lib/transit/tdx-stations";
import { todayInTaipei, nowHHmmInTaipei, minutesBetween, formatDuration } from "@/lib/transit/tdx-time";

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

// TicketType 7＝早鳥票。實際探查過多組起訖站的 ODFare 回應，目前都沒有看到 TicketType 7
// 的資料（早鳥是依出發前天數浮動的促銷折扣，不是固定存在 OD 票價表裡的一個價位），這裡
// 還是把判斷寫進來、查得到就顯示、查不到就不顯示那一欄——不是為了現在一定顯示得出來，
// 是避免哪天 TDX 真的把早鳥資料補進這個端點時還要再回來改一次。
function earlyBirdDiscountOf(entry: OdFareEntry, fullFare: number | undefined): string | undefined {
  if (fullFare === undefined) return undefined;
  const earlyBirdFare = entry.Fares.find((f) => f.TicketType === 7 && f.FareClass === 1 && f.CabinClass === 1)?.Price;
  if (earlyBirdFare === undefined) return undefined;
  const tier = Math.round((earlyBirdFare / fullFare) * 100) / 10;
  return `${tier % 1 === 0 ? tier.toFixed(0) : tier.toFixed(1)}折`;
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
    const fareEntry = fareEntries.status === "fulfilled" ? fareEntries.value[0] : undefined;
    const fullFare = fareEntry ? standardFullFareOf(fareEntry) : undefined;
    const earlyBirdDiscount = fareEntry ? earlyBirdDiscountOf(fareEntry, fullFare) : undefined;

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
        fare: fullFare !== undefined ? `NT$ ${fullFare}` : undefined,
        earlyBirdDiscount,
        isPast: date < today || (date === today && depTime < nowTime),
      };
    });

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "高鐵時刻查詢失敗" }, { status: 502 });
  }
}
