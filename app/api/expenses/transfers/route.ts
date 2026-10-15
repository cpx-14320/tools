import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listTransfers, createTransfer, updateTransfer, deleteTransfer } from "@/lib/expenses/transfers.server";

function parseInput(
  body: { fromAccountId?: unknown; toAccountId?: unknown; amount?: unknown; date?: unknown; note?: unknown } | null,
) {
  const fromAccountId = typeof body?.fromAccountId === "string" ? body.fromAccountId : "";
  const toAccountId = typeof body?.toAccountId === "string" ? body.toAccountId : "";
  const amount = Number(body?.amount);
  const date = typeof body?.date === "string" ? body.date : "";
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : undefined;
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || !Number.isFinite(amount) || amount <= 0 || !date) return null;
  return { fromAccountId, toAccountId, amount, date, note };
}

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const transfers = await listTransfers(new ObjectId(user.id));
  return NextResponse.json({ transfers });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const input = parseInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位，轉出/轉入帳戶也不能選同一個" }, { status: 400 });

  const { transfer, transfers } = await createTransfer(new ObjectId(user.id), input);
  return NextResponse.json({ transfer, transfers });
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const input = parseInput(body);
  if (!id || !input) return NextResponse.json({ error: "缺少必要欄位，轉出/轉入帳戶也不能選同一個" }, { status: 400 });

  const transfers = await updateTransfer(new ObjectId(user.id), id, input);
  return NextResponse.json({ transfers });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const transfers = await deleteTransfer(new ObjectId(user.id), id);
  return NextResponse.json({ transfers });
}
