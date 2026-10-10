import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { listTripGroups, createTripGroup, renameTripGroup, deleteTripGroup } from "@/lib/transit/trip-groups";
import { listFrequentTrips } from "@/lib/transit/frequent-trips";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const groups = await listTripGroups(new ObjectId(user.id));
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const mode = typeof body?.mode === "string" ? body.mode : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!mode || !name) return NextResponse.json({ error: "缺少 mode 或 name" }, { status: 400 });

  const { group, groups } = await createTripGroup(new ObjectId(user.id), mode, name);
  return NextResponse.json({ group, groups });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!id || !name) return NextResponse.json({ error: "缺少 id 或 name" }, { status: 400 });

  const groups = await renameTripGroup(new ObjectId(user.id), id, name);
  return NextResponse.json({ groups });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { groups } = await deleteTripGroup(new ObjectId(user.id), id);
  const trips = await listFrequentTrips(new ObjectId(user.id));
  return NextResponse.json({ groups, trips });
}
