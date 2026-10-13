import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { SalaryItemKind } from "@/lib/expenses/salary-types";
import {
  listSalaryItemTypes,
  createSalaryItemType,
  updateSalaryItemType,
  deleteSalaryItemType,
} from "@/lib/expenses/salary-types.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const types = await listSalaryItemTypes(new ObjectId(user.id));
  return NextResponse.json({ types });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kind = body?.kind === "加項" || body?.kind === "扣項" ? (body.kind as SalaryItemKind) : null;
  if (!name || !kind) return NextResponse.json({ error: "缺少 name 或 kind" }, { status: 400 });

  const { type, types } = await createSalaryItemType(new ObjectId(user.id), name, kind);
  return NextResponse.json({ type, types });
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kind = body?.kind === "加項" || body?.kind === "扣項" ? (body.kind as SalaryItemKind) : null;
  if (!id || !name || !kind) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const types = await updateSalaryItemType(new ObjectId(user.id), id, name, kind);
  return NextResponse.json({ types });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const types = await deleteSalaryItemType(new ObjectId(user.id), id);
  return NextResponse.json({ types });
}
