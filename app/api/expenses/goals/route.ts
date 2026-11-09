import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listGoalsWithProgress, createGoal, updateGoal, contributeToGoal, deleteGoal } from "@/lib/expenses/goals.server";

/** 綁定帳戶的三態解讀，跟 UpdateGoalInput 的約定一致：沒帶這個欄位＝不動，帶空字串／
 *  null＝解除綁定（改回手動記錄），帶 id＝綁到那個帳戶。 */
function readAccountId(body: unknown): string | null | undefined {
  if (!body || typeof body !== "object" || !("accountId" in body)) return undefined;
  const value = (body as { accountId: unknown }).accountId;
  return typeof value === "string" && value.trim() && ObjectId.isValid(value.trim()) ? value.trim() : null;
}

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const goals = await listGoalsWithProgress(new ObjectId(user.id));
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
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : undefined;
  const targetDate = typeof body?.targetDate === "string" && body.targetDate ? body.targetDate : undefined;
  if (!name || !icon || !Number.isFinite(targetAmount) || targetAmount <= 0 || !Number.isFinite(currentAmount) || currentAmount < 0) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const { goal, goals } = await createGoal(new ObjectId(user.id), {
    name,
    icon,
    targetAmount,
    currentAmount,
    accountId: readAccountId(body),
    startDate,
    targetDate,
  });
  return NextResponse.json({ goal, goals });
}

/** body 有 amount 代表「存入」操作（累加目前已存金額），否則視為編輯。
 *
 *  **存入（amount）這條路只剩固定收支的連動在用**：畫面上的「存入」已經併進編輯彈窗，
 *  那邊送的是 currentAmount 的新總額，不是增量。 */
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
  // 手動記錄模式才會帶：使用者在編輯彈窗裡直接改「目前已存」的總額。綁定帳戶時沒有這個
  // 欄位（進度來自餘額），所以不帶就是不動。
  const rawCurrent = Number(body?.currentAmount);
  const currentAmount = body?.currentAmount !== undefined && Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : undefined;
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : undefined;
  const targetDate = typeof body?.targetDate === "string" && body.targetDate ? body.targetDate : undefined;
  if (!name || !icon || !Number.isFinite(targetAmount) || targetAmount <= 0) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }
  const goals = await updateGoal(new ObjectId(user.id), id, {
    name,
    icon,
    targetAmount,
    currentAmount,
    accountId: readAccountId(body),
    startDate,
    targetDate,
  });
  return NextResponse.json({ goals });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { goals, trashId } = await deleteGoal(new ObjectId(user.id), id);
  return NextResponse.json({ goals, trashId });
}
