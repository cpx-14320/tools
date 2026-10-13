import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { CategoryColor, CategoryKind } from "@/lib/expenses/categories";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/lib/expenses/categories.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const categories = await listCategories(new ObjectId(user.id));
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const color = typeof body?.color === "string" ? (body.color as CategoryColor) : undefined;
  const kind = typeof body?.kind === "string" ? (body.kind as CategoryKind) : undefined;
  const parentId = typeof body?.parentId === "string" ? body.parentId : undefined;
  if (!name || !icon || (!parentId && (!color || !kind))) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const result = await createCategory(new ObjectId(user.id), { name, icon, color: color ?? "a", kind: kind ?? "支出", parentId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const icon = typeof body?.icon === "string" ? body.icon.trim() : "";
  const color = typeof body?.color === "string" ? (body.color as CategoryColor) : undefined;
  // 有帶這個欄位（不管值是什麼）才代表使用者這次有動預算；完全沒帶代表這次編輯不碰預算，
  // 跟 updateCategory 的 undefined／null／number 三態約定對齊（見 categories.server.ts）。
  const budgetAmount =
    body && typeof body === "object" && "budgetAmount" in body
      ? typeof body.budgetAmount === "number" && Number.isFinite(body.budgetAmount) && body.budgetAmount > 0
        ? body.budgetAmount
        : null
      : undefined;
  if (!id || !name || !icon) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const categories = await updateCategory(new ObjectId(user.id), id, { name, icon, color, budgetAmount });
  return NextResponse.json({ categories });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const categories = await deleteCategory(new ObjectId(user.id), id);
  return NextResponse.json({ categories });
}
