import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/transit/tdx-client";
import { getTraStations } from "@/lib/transit/tdx-stations";

interface FareEntry {
  Direction: number;
  TrainType: number;
  TravelDistance: number;
  Fares: { TicketType: number; FareClass: number; Price: number }[];
}

// TDX 的 TrainType 跟 StationLiveBoard／DailyTrainTimetable 回傳的 TrainTypeCode 是同一套編碼：
// 3=自強、4=莒光、6=區間（其餘車種目前這個工具不需要顯示）。
const TRAIN_TYPE_LABEL: Record<number, "自強" | "莒光" | "區間"> = { 3: "自強", 4: "莒光", 6: "區間" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = params.get("origin") ?? "";
  const dest = params.get("dest") ?? "";

  try {
    const stations = await getTraStations();
    const originId = stations.find((s) => s.name === origin)?.id;
    const destId = stations.find((s) => s.name === dest)?.id;
    if (!originId || !destId) {
      return NextResponse.json({ fares: {}, error: `沒有「${origin}」或「${dest}」的台鐵站碼對照` }, { status: 400 });
    }

    const data = await tdxGet<{ ODFares: FareEntry[] }>(`/v3/Rail/TRA/ODFare/${originId}/to/${destId}`);

    // 台鐵是環島路網，同一個起訖站可能同時有「直達」跟「繞一圈」兩種距離的票價，只取距離較短的那組。
    const byDirection = new Map<number, FareEntry[]>();
    for (const f of data.ODFares) {
      const list = byDirection.get(f.Direction) ?? [];
      list.push(f);
      byDirection.set(f.Direction, list);
    }
    const directEntries = [...byDirection.values()].sort((a, b) => a[0].TravelDistance - b[0].TravelDistance)[0] ?? [];

    const fares: Partial<Record<"自強" | "莒光" | "區間", number>> = {};
    for (const entry of directEntries) {
      const label = TRAIN_TYPE_LABEL[entry.TrainType];
      if (!label || fares[label] !== undefined) continue;
      const fullFare = entry.Fares.find((f) => f.TicketType === 1 && f.FareClass === 1);
      if (fullFare) fares[label] = fullFare.Price;
    }

    return NextResponse.json({ fares, distanceKm: directEntries[0]?.TravelDistance });
  } catch (err) {
    return NextResponse.json({ fares: {}, error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
