import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { isValidYearMonth } from "@/lib/expenses/budgets";
import { listBudgetRules, upsertBudgetRule, deleteBudgetRule } from "@/lib/expenses/budgets.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const rules = await listBudgetRules(new ObjectId(user.id));
  return NextResponse.json({ rules });
}

/** 新增或修改一筆「某分類從某個月起預算多少」。同一個分類同一個月只會有一筆，重複送
 *  就是改金額（見 upsertBudgetRule）。金額允許 0，代表「從這個月起這個分類不編預算」。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const categoryId = typeof body?.categoryId === "string" ? body.categoryId : "";
  const effectiveFrom = typeof body?.effectiveFrom === "string" ? body.effectiveFrom : "";
  const amount = Number(body?.amount);
  if (!categoryId || !isValidYearMonth(effectiveFrom) || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "缺少必要欄位或格式不正確" }, { status: 400 });
  }

  const rules = await upsertBudgetRule(new ObjectId(user.id), { categoryId, effectiveFrom, amount });
  return NextResponse.json({ rules });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const rules = await deleteBudgetRule(new ObjectId(user.id), id);
  return NextResponse.json({ rules });
}
