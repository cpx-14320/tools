import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/transit/tdx-client";
import { getTraStations } from "@/lib/transit/tdx-stations";
import { todayInTaipei, nowHHmmInTaipei, minutesBetween, formatDuration } from "@/lib/transit/tdx-time";

interface StopTime {
  StationID: string;
  StopSequence: number;
  ArrivalTime: string;
  DepartureTime: string;
}

interface TrainTimetableEntry {
  // TrainTypeCode 是台鐵官方的「車種等級」代碼（跟 ODFare 票價表裡的 TrainType 是同一套數字），
  // 比自己猜測中文車種名稱對應哪個票價等級準確多了，直接拿來查票價表。
  TrainInfo: { TrainNo: string; TrainTypeName: { Zh_tw: string }; TrainTypeCode: string; Note: string };
  StopTimes: StopTime[];
}

interface StationLiveBoardRow {
  TrainNo: string;
  DelayTime: number;
}

interface OdFareEntry {
  TrainType: number;
  TravelDistance: number;
  Fares: { TicketType: number; FareClass: number; Price: number }[];
}

// 全票價：TicketType 1 = 全票，FareClass 3 的全票價在各車種等級裡都是一致的那個數字
// （商務／對號座等其他 FareClass 的價格另算，不是一般旅客平常看到的票價）。
function fullFareOf(entry: OdFareEntry): number | undefined {
  return entry.Fares.find((f) => f.TicketType === 1 && f.FareClass === 3)?.Price;
}

// 同一個起訖站 TDX 常常同時回傳「直達」跟「繞道環島」兩種距離完全不同的報價，
// 只有距離最短的那組才是使用者真正會搭的這段票價。
async function getFullFareByTrainType(originId: string, destId: string): Promise<Map<number, number>> {
  const data = await tdxGet<{ ODFares: OdFareEntry[] }>(`/v3/Rail/TRA/ODFare/${originId}/to/${destId}`, 24 * 60 * 60 * 1000);
  const minDistance = Math.min(...data.ODFares.map((f) => f.TravelDistance));
  const map = new Map<number, number>();
  for (const entry of data.ODFares) {
    if (entry.TravelDistance !== minDistance) continue;
    const price = fullFareOf(entry);
    if (price !== undefined) map.set(entry.TrainType, price);
  }
  return map;
}

// TDX 的車種全名會細分到車型／有無自行車車廂（例如「自強(3000)(EMU3000 型電車)」
// 「自強(推拉式自強號且有自行車車廂)」），前台只需要顯示「自強」這種通稱就好，
// 子類型說明對使用者沒有意義，統一在這裡清掉，前台自然不用再處理這些雜訊。
const TRAIN_TYPE_PREFIXES = ["自強", "普悠瑪", "太魯閣", "區間快", "區間", "莒光"];

function simplifyTrainType(name: string): string {
  return TRAIN_TYPE_PREFIXES.find((prefix) => name.startsWith(prefix)) ?? name;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = params.get("origin") ?? "";
  const dest = params.get("dest") ?? "";
  const today = todayInTaipei();
  const date = params.get("date") || today;
  // 「已過期」要跟真實的現在時間比，不能用使用者選的搜尋時間——不然選了某個時間點查詢，
  // 那個時間點之前的車次全部會被標成過期，即使實際上根本還沒發車（例如首頁「記住上次查詢」
  // 復原了之前選的時間，跟當下真正的時間完全無關）。查詢的日期如果不是今天，過去/未來一整天
  // 直接整批判斷，不用管時分。
  const nowTime = nowHHmmInTaipei();

  try {
    const stations = await getTraStations();
    const originId = stations.find((s) => s.name === origin)?.id;
    const destId = stations.find((s) => s.name === dest)?.id;
    if (!originId || !destId) {
      return NextResponse.json({ rows: [], error: `沒有「${origin}」或「${dest}」的台鐵站碼對照` }, { status: 400 });
    }

    const [timetable, liveBoard, fareByType] = await Promise.allSettled([
      tdxGet<{ TrainTimetables: TrainTimetableEntry[] }>(`/v3/Rail/TRA/DailyTrainTimetable/OD/${originId}/to/${destId}/${date}`),
      tdxGet<{ StationLiveBoards: StationLiveBoardRow[] }>(`/v3/Rail/TRA/StationLiveBoard/Station/${originId}`),
      getFullFareByTrainType(originId, destId),
    ]);

    if (timetable.status === "rejected") throw timetable.reason;

    const delayByTrainNo = new Map<string, number>();
    if (liveBoard.status === "fulfilled") {
      for (const b of liveBoard.value.StationLiveBoards) delayByTrainNo.set(b.TrainNo, b.DelayTime);
    }
    const fareMap = fareByType.status === "fulfilled" ? fareByType.value : new Map<number, number>();

    const rows = timetable.value.TrainTimetables.map((t) => {
      const originStop = t.StopTimes.find((s) => s.StationID === originId);
      const destStop = t.StopTimes.find((s) => s.StationID === destId);
      if (!originStop || !destStop) return null;
      const depTime = originStop.DepartureTime.slice(0, 5);
      const arrival = destStop.ArrivalTime.slice(0, 5);
      const stopCount = destStop.StopSequence - originStop.StopSequence + 1;
      const duration = formatDuration(minutesBetween(depTime, arrival));
      const fullFare = fareMap.get(Number(t.TrainInfo.TrainTypeCode));
      return {
        time: depTime,
        arrive: arrival,
        duration,
        stops: stopCount,
        code: `${simplifyTrainType(t.TrainInfo.TrainTypeName.Zh_tw)} ${t.TrainInfo.TrainNo} 次`,
        destName: dest,
        note: `抵達 ${arrival}・車程 ${duration}・停靠 ${stopCount} 站`,
        fare: fullFare !== undefined ? `NT$ ${fullFare}` : undefined,
        // 「每日行駛」「只在假日行駛」之類的行駛狀態說明，台鐵官方寫好的文字直接顯示，不用自己組句子。
        operatingNote: t.TrainInfo.Note,
        delayMinutes: delayByTrainNo.get(t.TrainInfo.TrainNo),
        isPast: date < today || (date === today && depTime < nowTime),
      };
    })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
