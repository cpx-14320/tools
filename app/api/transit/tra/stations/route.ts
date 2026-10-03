import { NextResponse } from "next/server";
import { groupTraStationsByCity } from "@/lib/tdx-stations";

export async function GET() {
  try {
    const cities = await groupTraStationsByCity();
    return NextResponse.json({ cities });
  } catch (err) {
    return NextResponse.json({ cities: [], error: err instanceof Error ? err.message : "TDX 查詢失敗" }, { status: 502 });
  }
}
