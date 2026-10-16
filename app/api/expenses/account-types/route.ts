import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { AccountKind } from "@/lib/expenses/account-types";
import { listAccountTypes, createAccountType, updateAccountType, deleteAccountType } from "@/lib/expenses/account-types.server";

function parseCreateInput(body: { name?: unknown; icon?: unknown; kind?: unknown } | null) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const kind = body?.kind === "asset" || body?.kind === "liability" ? (body.kind as AccountKind) : null;
  if (!name || !icon || !kind) return null;
  return { name, icon, kind };
}

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const accountTypes = await listAccountTypes(new ObjectId(user.id));
  return NextResponse.json({ accountTypes });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const input = parseCreateInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const result = await createAccountType(new ObjectId(user.id), input);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  if (!id || !name || !icon) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const result = await updateAccountType(new ObjectId(user.id), id, { name, icon });
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const result = await deleteAccountType(new ObjectId(user.id), id);
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
