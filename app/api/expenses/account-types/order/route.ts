import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { reorderAccountTypes } from "@/lib/expenses/account-types.server";

/** 重排帳戶類型的順序。body 是 `{ ids: [...] }`——那一段（資產或負債）排好的完整順序。
 *  跟分類的排序同一套，理由見 reorderAccountTypes。 */
export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !ObjectId.isValid(id))) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const accountTypes = await reorderAccountTypes(new ObjectId(user.id), ids as string[]);
  return NextResponse.json({ accountTypes });
}
