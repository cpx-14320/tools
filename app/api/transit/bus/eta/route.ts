import { NextResponse } from "next/server";
import { tdxGet } from "@/lib/tdx-client";
import { BUS_ROUTE_BY_STOP } from "@/lib/tdx-stations";

interface RouteInfo {
  DepartureStopNameZh: string;
  DestinationStopNameZh: string;
}

interface EtaRow {
  StopName: { Zh_tw: string };
  RouteName: { Zh_tw: string };
  Direction: number;
  StopStatus: number;
  EstimateTime?: number;
}

export async function GET(request: Request) {
  const stop = new URL(request.url).searchParams.get("stop") ?? "";
  const lookup = BUS_ROUTE_BY_STOP[stop];
  if (!lookup) {
    return NextResponse.json({ rows: [], error: `沒有「${stop}」的公車路線對照，請先在 lib/tdx-stations.ts 補上` }, { status: 400 });
  }

  try {
    const [routeInfo, etas] = await Promise.all([
      tdxGet<RouteInfo[]>(`/v2/Bus/Route/City/${lookup.city}/${encodeURIComponent(lookup.routeName)}`),
      tdxGet<EtaRow[]>(`/v2/Bus/EstimatedTimeOfArrival/City/${lookup.city}/${encodeURIComponent(lookup.routeName)}`),
    ]);
    const info = routeInfo[0];
    const headsign = (direction: number) =>
      info ? `往${direction === 0 ? info.DestinationStopNameZh : info.DepartureStopNameZh}` : `方向 ${direction}`;

    const rows = etas
      .filter((e) => e.StopName.Zh_tw === stop)
      .map((e) => ({
        time: e.StopStatus === 0 && e.EstimateTime !== undefined ? `預估 ${Math.max(0, Math.round(e.EstimateTime / 60))} 分` : "尚無資料",
        code: e.RouteName.Zh_tw,
        destName: headsign(e.Direction),
      }));
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ rows: [], error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
