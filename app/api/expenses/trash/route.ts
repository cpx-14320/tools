import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { emptyTrash, listTrash, previewRestore, purgeTrashItem, restoreFromTrash } from "@/lib/expenses/trash.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const items = await listTrash(new ObjectId(user.id));
  return NextResponse.json({ items });
}

/** `restore` 還原一項、`purge` 永久刪一項、`empty` 清空整個垃圾桶、`preview` 問「這幾項
 *  還原的話會不會撞名」。
 *
 *  還原的結果可能帶兩種提醒：`renamedTo`（撞名被自動加了序號）、`droppedRefs`（原本
 *  掛的帳戶已經不在，那個欄位被清掉）。這兩種都不是錯誤，但使用者需要知道。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const userId = new ObjectId(user.id);

  if (action === "empty") {
    const deleted = await emptyTrash(userId);
    return NextResponse.json({ deleted, items: [] });
  }

  // 預檢收的是一整批 id（不是單筆）：批次還原時要一次問完，彈窗才能把所有會改名的
  // 列在同一個畫面上，而不是一項跳一次。
  if (action === "preview") {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === "string") : [];
    return NextResponse.json({ renames: await previewRestore(userId, ids) });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  if (action === "purge") {
    await purgeTrashItem(userId, id);
    return NextResponse.json({ items: await listTrash(userId) });
  }

  if (action !== "restore") return NextResponse.json({ error: "action 只能是 restore、purge、empty 或 preview" }, { status: 400 });

  const result = await restoreFromTrash(userId, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ...result, items: await listTrash(userId) });
}
