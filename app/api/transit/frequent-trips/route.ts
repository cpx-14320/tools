import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { listFrequentTrips, syncFrequentTrips, type FrequentTripInput } from "@/lib/frequent-trips";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const trips = await listFrequentTrips(new ObjectId(user.id));
  return NextResponse.json({ trips });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const groupId = typeof body?.groupId === "string" ? body.groupId : "";
  if (!mode || !groupId) return NextResponse.json({ error: "缺少 mode 或 groupId" }, { status: 400 });

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items: FrequentTripInput[] = rawItems
    .map((item: { id?: unknown; icon?: unknown; originCity?: unknown; origin?: unknown; destCity?: unknown; dest?: unknown; startTime?: unknown; endTime?: unknown }) => ({
      id: typeof item?.id === "string" ? item.id : undefined,
      icon: typeof item?.icon === "string" ? item.icon : "",
      originCity: typeof item?.originCity === "string" ? item.originCity : "",
      origin: typeof item?.origin === "string" ? item.origin : "",
      destCity: typeof item?.destCity === "string" ? item.destCity : "",
      dest: typeof item?.dest === "string" ? item.dest : "",
      startTime: typeof item?.startTime === "string" ? item.startTime : "",
      endTime: typeof item?.endTime === "string" ? item.endTime : "",
    }))
    .filter((item: FrequentTripInput) => item.origin && item.dest);

  const trips = await syncFrequentTrips(new ObjectId(user.id), mode, groupId, items);
  return NextResponse.json({ trips });
}
