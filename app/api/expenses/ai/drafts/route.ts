import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listCategories } from "@/lib/expenses/categories.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { commitImportedTransactions, listTransactions } from "@/lib/expenses/transactions.server";
import { closeAiDraft, deleteAiDraft, deleteClosedAiDrafts, getAiDraft, listAiDrafts, updateAiDraftItem } from "@/lib/expenses/ai-drafts.server";
import { needsSubcategory } from "@/lib/expenses/categories";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const drafts = await listAiDrafts(new ObjectId(user.id));
  return NextResponse.json({ drafts });
}

/** 改草稿裡的某一筆（補分類、改金額／日期／備註／帳戶，或標成略過）。 */
export async function PATCH(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const key = typeof body?.key === "string" ? body.key : "";
  if (!draftId || !key) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const userId = new ObjectId(user.id);
  const patch: Record<string, unknown> = {};

  if (body.categoryId !== undefined) {
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    if (categoryId) {
      const categories = await listCategories(userId);
      if (!categories.some((c) => c.id === categoryId)) return NextResponse.json({ error: "找不到這個分類" }, { status: 400 });
      // 有子項目的大分類不能直接記帳，補分類時一樣要擋。
      if (needsSubcategory(categories, categoryId)) return NextResponse.json({ error: "這個分類底下還有項目，要選到項目" }, { status: 400 });
    }
    patch.categoryId = categoryId || null;
  }
  if (typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0) patch.amount = body.amount;
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) patch.date = body.date;
  if (body.note !== undefined) patch.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
  if (body.accountId !== undefined) patch.accountId = typeof body.accountId === "string" && body.accountId ? body.accountId : undefined;
  if (body.state === "skipped" || body.state === "pending") patch.state = body.state;

  const draft = await updateAiDraftItem(userId, draftId, key, patch);
  if (!draft) return NextResponse.json({ error: "找不到這一批草稿" }, { status: 404 });
  return NextResponse.json({ draft });
}

/** 把草稿裡還沒處理、而且已經分好類的那幾筆寫成真的交易紀錄。
 *
 *  走既有的 commitImportedTransactions（CSV 匯入也用它），所以「跟現有紀錄比對去重」
 *  這件事不用在這裡重寫一遍——同一批不小心按兩次確認，第二次會因為內容完全相同被擋掉。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  const userId = new ObjectId(user.id);

  if (action === "clearClosed") {
    const deleted = await deleteClosedAiDrafts(userId);
    return NextResponse.json({ deleted, drafts: await listAiDrafts(userId) });
  }

  if (!draftId) return NextResponse.json({ error: "缺少 draftId" }, { status: 400 });

  if (action === "discard") {
    await closeAiDraft(userId, draftId, "discarded");
    return NextResponse.json({ drafts: await listAiDrafts(userId) });
  }

  if (action === "delete") {
    await deleteAiDraft(userId, draftId);
    return NextResponse.json({ drafts: await listAiDrafts(userId) });
  }

  if (action !== "commit") return NextResponse.json({ error: "action 只能是 commit、discard、delete 或 clearClosed" }, { status: 400 });

  const draft = await getAiDraft(userId, draftId);
  if (!draft) return NextResponse.json({ error: "找不到這一批草稿" }, { status: 404 });

  const categoryIds = new Set((await listCategories(userId)).map((c) => c.id));
  const accountIds = new Set((await listAccounts(userId)).map((a) => a.id));
  // 只寫「還沒處理 ＋ 已經有分類」的那幾筆。沒分類的留在批次裡，使用者補完再按一次。
  const rows = draft.items
    .filter((i) => i.state === "pending" && i.categoryId && categoryIds.has(i.categoryId))
    .map((i) => ({
      categoryId: i.categoryId as string,
      amount: i.amount,
      date: i.date,
      note: i.note,
      accountId: i.accountId && accountIds.has(i.accountId) ? i.accountId : undefined,
    }));

  if (rows.length === 0) return NextResponse.json({ error: "沒有可以寫入的紀錄" }, { status: 400 });

  const count = await commitImportedTransactions(userId, rows);
  await closeAiDraft(userId, draftId, "committed");

  return NextResponse.json({ count, drafts: await listAiDrafts(userId), transactions: await listTransactions(userId) });
}
