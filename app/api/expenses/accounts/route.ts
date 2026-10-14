import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/expenses/accounts.server";

function parseInput(body: { name?: unknown; accountTypeId?: unknown; openingBalance?: unknown } | null) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const accountTypeId = typeof body?.accountTypeId === "string" ? body.accountTypeId : "";
  const openingBalance = Number(body?.openingBalance);
  if (!name || !accountTypeId || !Number.isFinite(openingBalance) || openingBalance < 0) return null;
  return { name, accountTypeId, openingBalance };
}

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const accounts = await listAccounts(new ObjectId(user.id));
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const input = parseInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const { account, accounts } = await createAccount(new ObjectId(user.id), input);
  return NextResponse.json({ account, accounts });
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const input = parseInput(body);
  if (!id || !input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const accounts = await updateAccount(new ObjectId(user.id), id, input);
  return NextResponse.json({ accounts });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const accounts = await deleteAccount(new ObjectId(user.id), id);
  return NextResponse.json({ accounts });
}
