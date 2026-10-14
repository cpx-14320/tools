import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { breakdownNet, type BreakdownItem } from "@/lib/expenses/transactions";
import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from "@/lib/expenses/transactions.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const transactions = await listTransactions(new ObjectId(user.id));
  return NextResponse.json({ transactions });
}

/** 明細陣列沒通過驗證就整個丟掉、退回一般交易（沒有 breakdown）——不要讓單一一列壞掉的
 *  明細擋住整筆交易的新增/編輯。 */
function parseBreakdown(raw: unknown): BreakdownItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: BreakdownItem[] = [];
  for (const row of raw) {
    const label = typeof row?.label === "string" ? row.label.trim() : "";
    const kind = row?.kind === "加項" || row?.kind === "扣項" ? row.kind : null;
    const amount = Number(row?.amount);
    if (!label || !kind || !Number.isFinite(amount) || amount <= 0) return undefined;
    items.push({ label, kind, amount });
  }
  return items.length > 0 ? items : undefined;
}

function parseInput(
  body: { categoryId?: unknown; amount?: unknown; date?: unknown; note?: unknown; breakdown?: unknown; accountId?: unknown } | null,
) {
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const note = typeof body?.note === "string" ? body.note.trim() || undefined : undefined;
  const breakdown = parseBreakdown(body?.breakdown);
  const accountId = typeof body?.accountId === "string" && body.accountId ? body.accountId : undefined;
  // 有明細就用明細淨額當金額（跟 transactions.server.ts 的 resolveAmount 同一套規則），
  // 沒有明細才看前端送來的 amount 欄位。
  const amount = breakdown ? breakdownNet(breakdown) : Number(body?.amount);
  if (!categoryId || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { categoryId, amount, date, note, breakdown, accountId };
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
