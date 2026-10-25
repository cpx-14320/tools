import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { DEFAULT_ACCOUNT_TYPE_COLOR, type AccountKind } from "@/lib/expenses/account-types";
import type { CategoryColor } from "@/lib/expenses/categories";
import { listAccountTypes, createAccountType, updateAccountType, deleteAccountType } from "@/lib/expenses/account-types.server";

function parseColor(value: unknown): CategoryColor {
  return typeof value === "string" ? (value as CategoryColor) : DEFAULT_ACCOUNT_TYPE_COLOR;
}

function parseCreateInput(body: { name?: unknown; icon?: unknown; kind?: unknown; color?: unknown } | null) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const kind = body?.kind === "asset" || body?.kind === "liability" ? (body.kind as AccountKind) : null;
  if (!name || !icon || !kind) return null;
  return { name, icon, kind, color: parseColor(body?.color) };
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
  // kind 可不送（只改名稱／圖示／顏色時）；有送才會嘗試搬動資產/負債，而且底下已經有
  // 帳戶在用的話伺服器會擋下來（見 updateAccountType）。
  const kind = body?.kind === "asset" || body?.kind === "liability" ? body.kind : undefined;
  if (!id || !name || !icon) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const result = await updateAccountType(new ObjectId(user.id), id, { name, icon, color: parseColor(body?.color), kind });
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
