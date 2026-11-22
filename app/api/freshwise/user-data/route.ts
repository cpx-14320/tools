import { NextResponse } from "next/server";
import { requireTool } from "@/lib/auth";
import { clearUserData, loadUserData, savePrefs, saveBasket } from "@/lib/freshwise/user-data.server";

// 偏好與菜籃。兩者都跟著帳號走（見 lib/freshwise/user-data.server.ts）。
//
// 寫入一律經過 normalize：這支是公開 API，送進來的東西不能直接當成合法資料寫進資料庫。

export async function GET() {
  const user = await requireTool("freshwise");
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await loadUserData(user.id));
}

export async function POST(request: Request) {
  const user = await requireTool("freshwise");
  if (user instanceof NextResponse) return user;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });

  // 一次只改一種，兩種都給也可以（設定頁的「還原預設菜籃」只動菜籃、換場所只動偏好）。
  const result: Record<string, unknown> = {};
  if ("prefs" in body) result.prefs = await savePrefs(user.id, body.prefs);
  if ("basket" in body) result.basket = await saveBasket(user.id, body.basket);
  if (Object.keys(result).length === 0) return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });

  return NextResponse.json(result);
}

/** 設定頁的「清除全部資料」。 */
export async function DELETE() {
  const user = await requireTool("freshwise");
  if (user instanceof NextResponse) return user;
  await clearUserData(user.id);
  return NextResponse.json({ ok: true });
}
