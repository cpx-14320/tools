import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from "@/lib/expenses/transactions.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const transactions = await listTransactions(new ObjectId(user.id));
  return NextResponse.json({ transactions });
}

function parseInput(body: { categoryId?: unknown; amount?: unknown; date?: unknown; note?: unknown } | null) {
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const amount = Number(body?.amount);
  const date = typeof body?.date === "string" ? body.date : "";
  const note = typeof body?.note === "string" ? body.note.trim() || undefined : undefined;
  if (!categoryId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { categoryId, amount, date, note };
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const input = parseInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const result = await createTransaction(new ObjectId(user.id), input);
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const input = parseInput(body);
  if (!id || !input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const transactions = await updateTransaction(new ObjectId(user.id), id, input);
  return NextResponse.json({ transactions });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const transactions = await deleteTransaction(new ObjectId(user.id), id);
  return NextResponse.json({ transactions });
}
