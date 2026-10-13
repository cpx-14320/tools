import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listGoals, createGoal, updateGoal, contributeToGoal, deleteGoal } from "@/lib/expenses/goals.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const goals = await listGoals(new ObjectId(user.id));
  return NextResponse.json({ goals });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const targetAmount = Number(body?.targetAmount);
  const currentAmount = Number(body?.currentAmount ?? 0);
  const targetDate = typeof body?.targetDate === "string" && body.targetDate ? body.targetDate : undefined;
  if (!name || !icon || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const { goal, goals } = await createGoal(new ObjectId(user.id), { name, icon, targetAmount, currentAmount, targetDate });
  return NextResponse.json({ goal, goals });
}

/** body 有 amount 代表「存入」操作（累加目前已存金額），否則視為編輯名稱/icon/目標金額/期限。 */
export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  if (body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "金額不正確" }, { status: 400 });
    const goals = await contributeToGoal(new ObjectId(user.id), id, amount);
    return NextResponse.json({ goals });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const targetAmount = Number(body?.targetAmount);
  const targetDate = typeof body?.targetDate === "string" && body.targetDate ? body.targetDate : undefined;
  if (!name || !icon || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }
  const goals = await updateGoal(new ObjectId(user.id), id, { name, icon, targetAmount, targetDate });
  return NextResponse.json({ goals });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const goals = await deleteGoal(new ObjectId(user.id), id);
  return NextResponse.json({ goals });
}
