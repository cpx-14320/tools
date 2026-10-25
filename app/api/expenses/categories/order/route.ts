import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { reorderCategories } from "@/lib/expenses/categories.server";

/** 重排同一層分類的順序。body 是 `{ ids: [...] }`——那一層排好的完整順序，不是
 *  「把 A 跟 B 交換」。整串重寫才是冪等的，理由見 reorderCategories。 */
export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !ObjectId.isValid(id))) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const categories = await reorderCategories(new ObjectId(user.id), ids as string[]);
  return NextResponse.json({ categories });
}
