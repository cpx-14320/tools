import { NextResponse } from "next/server";
import { ICON_OTHER } from "@/lib/expenses/presets";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { CategoryColor, CategoryDTO, CategoryKind } from "@/lib/expenses/categories";
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
  // 沒送圖示就給共用的「其他」佔位圖：畫面上的新增彈窗一定會帶一張，但 CSV 匯入
  // 沒有圖示欄（圖示是從固定清單裡挑的圖檔路徑，在試算表裡手打只會打錯，見 csv.ts），
  // 匯進來的分類先掛佔位圖，之後在畫面上挑一張就好。
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim() : ICON_OTHER;
  const color = typeof body?.color === "string" ? (body.color as CategoryColor) : undefined;
  const kind = typeof body?.kind === "string" ? (body.kind as CategoryKind) : undefined;
  const parentId = typeof body?.parentId === "string" ? body.parentId : undefined;
  // 子分類不用送圖示／顏色／收支類型，三個都由 createCategory 從父分類複製過來；
  // 大分類只有名稱跟收支類型是必填，顏色沒送就用 a。
  if (!name || (!parentId && !kind)) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const result = await createCategory(new ObjectId(user.id), { name, icon, color: color ?? "a", kind: kind ?? "支出", parentId });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  // 沒送就是 undefined（不是空字串）——updateCategory 靠 undefined 判斷「這次不改這個欄位」，
  // 傳空字串進去會被當成真的要改，把圖示清掉。
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim() : undefined;
  const color = typeof body?.color === "string" ? (body.color as CategoryColor) : undefined;
  // 有帶這個欄位（不管值是什麼）才代表使用者這次有動預算；完全沒帶代表這次編輯不碰預算，
  // 跟 updateCategory 的 undefined／null／number 三態約定對齊（見 categories.server.ts）。
  const budgetAmount =
    body && typeof body === "object" && "budgetAmount" in body
      ? typeof body.budgetAmount === "number" && Number.isFinite(body.budgetAmount) && body.budgetAmount > 0
        ? body.budgetAmount
        : null
      : undefined;
  // 預設帳戶跟 budgetAmount 同一套三態：沒帶＝不動，帶空字串／null＝清掉，帶 id＝設定。
  const defaultAccountId =
    body && typeof body === "object" && "defaultAccountId" in body
      ? typeof body.defaultAccountId === "string" && body.defaultAccountId.trim()
        ? body.defaultAccountId.trim()
        : null
      : undefined;
  // 只有名稱是必填：子分類的編輯只會送名稱，圖示／顏色跟著父分類，沒送就維持原值
  // （updateCategory 會濾掉 undefined 的欄位）。
  if (!id || !name) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const result = await updateCategory(new ObjectId(user.id), id, { name, icon, color, budgetAmount, defaultAccountId });
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

/** 批次只改「預設帳戶」這一個欄位。
 *
 *  **為什麼不沿用 PUT**：PUT 的守門式是 `if (!id || !name)`，批次沒有名稱可以送。為了
 *  過那道檢查而把現有名稱一起回送更糟——使用者在另一個分頁剛把名稱改掉，這邊會拿畫面上
 *  的舊名字覆蓋回去。這支只收 ids 跟 defaultAccountId，碰不到別的欄位。
 *
 *  一次收一整批 id（不是前端迴圈一筆一筆打）：少掉幾十個來回，而且回傳的是全部跑完之後
 *  的完整清單，前端不用自己合併中間狀態。 */
export async function PATCH(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string" && ObjectId.isValid(id)) : [];
  // 跟 PUT 一樣的約定：空字串／null＝改成「不指定」。這支的 defaultAccountId 一定會動，
  // 所以不需要 undefined 那個「不要動」的狀態。
  const defaultAccountId = typeof body?.defaultAccountId === "string" && body.defaultAccountId.trim() ? body.defaultAccountId.trim() : null;
  if (ids.length === 0) return NextResponse.json({ error: "沒有要修改的分類" }, { status: 400 });

  const userId = new ObjectId(user.id);
  let updated = 0;
  let last: { categories: CategoryDTO[] } | null = null;
  for (const id of ids) {
    const result = await updateCategory(userId, id, { defaultAccountId });
    // 其中一筆失敗不中斷：改預設帳戶是各自獨立的，為了一筆撞到問題就讓另外二十筆也不生效
    // 沒有好處。真正改到幾筆回報給前端，由它決定要說什麼。
    if ("error" in result) continue;
    updated += 1;
    last = result;
  }

  // 一筆都沒成功時也要回最新清單，前端才不會停在舊資料上。
  const categories = last ? last.categories : await listCategories(userId);
  return NextResponse.json({ updated, categories });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const force = searchParams.get("force") === "1";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const result = await deleteCategory(new ObjectId(user.id), id, { force });
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}
