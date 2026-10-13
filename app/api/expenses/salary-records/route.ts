import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { SalaryRecordItem } from "@/lib/expenses/salary-records";
import { listSalaryRecords, createSalaryRecord, updateSalaryRecord, deleteSalaryRecord } from "@/lib/expenses/salary-records.server";

function parseItems(body: unknown): SalaryRecordItem[] | null {
  if (!Array.isArray((body as { items?: unknown })?.items)) return null;
  const items = (body as { items: unknown[] }).items;
  const parsed: SalaryRecordItem[] = [];
  for (const item of items) {
    const typeId = typeof (item as { typeId?: unknown })?.typeId === "string" ? (item as { typeId: string }).typeId : "";
    const amount = Number((item as { amount?: unknown })?.amount);
    if (!typeId || !Number.isFinite(amount) || amount <= 0) return null;
    parsed.push({ typeId, amount });
  }
  return parsed;
}

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const records = await listSalaryRecords(new ObjectId(user.id));
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const yearMonth = typeof body?.yearMonth === "string" ? body.yearMonth : "";
  const items = parseItems(body);
  if (!/^\d{4}-\d{2}$/.test(yearMonth) || !items || items.length === 0) {
    return NextResponse.json({ error: "缺少 yearMonth 或明細項目" }, { status: 400 });
  }

  const result = await createSalaryRecord(new ObjectId(user.id), yearMonth, items);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const items = parseItems(body);
  if (!id || !items || items.length === 0) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const records = await updateSalaryRecord(new ObjectId(user.id), id, items);
  return NextResponse.json({ records });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const records = await deleteSalaryRecord(new ObjectId(user.id), id);
  return NextResponse.json({ records });
}
