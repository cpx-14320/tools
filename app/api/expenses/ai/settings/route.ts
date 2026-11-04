import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { setExpensesSettings } from "@/lib/expenses/settings.server";

/** 「要不要顯示 AI 記帳入口」的開關。存伺服器端，Server Component 才能當場決定要不要
 *  畫那顆浮動鈕（理由見 lib/expenses/settings.server.ts）。 */
export async function PATCH(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  if (typeof body?.aiEnabled !== "boolean") return NextResponse.json({ error: "缺少 aiEnabled" }, { status: 400 });

  const settings = await setExpensesSettings(new ObjectId(user.id), { aiEnabled: body.aiEnabled });
  return NextResponse.json({ settings });
}
