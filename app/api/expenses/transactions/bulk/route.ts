import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listCategories } from "@/lib/expenses/categories.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { bulkUpdateTransactions } from "@/lib/expenses/transactions.server";
import { needsSubcategory } from "@/lib/expenses/categories";

/** 批次只改「掛在哪個分類／哪個帳戶」。給明細頁的多選模式用（選一批 → 改帳戶／改分類）。
 *
 *  用 PATCH 而不是逐筆 PUT：一次往返、語意清楚，而且「只能改自己的」這件事只寫在一個
 *  地方（見 bulkUpdateTransactions 的 userId 條件），不會在迴圈裡漏掉某一筆。
 *
 *  body：`{ ids: string[], set: { categoryId?: string, accountId?: string | null } }`
 *  `accountId` 傳 null＝改成不指定帳戶，不傳＝不要動這個欄位（兩者意義不同）。 */
export async function PATCH(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const rawIds: unknown = body?.ids;
  const ids = Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string" && ObjectId.isValid(id)) : [];
  if (ids.length === 0) return NextResponse.json({ error: "缺少要修改的紀錄" }, { status: 400 });

  const userId = new ObjectId(user.id);
  const set: { categoryId?: string; accountId?: string | null } = {};

  // 分類：一定要是自己現有的分類，而且不能是「底下還有子分類」的大分類——那種分類本來
  // 就不能直接記帳（見 categories.ts 的 needsSubcategory），批次塞進去會產生一批在
  // 編輯彈窗裡存不回去的紀錄。
  if (body?.categoryId !== undefined) {
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const categories = await listCategories(userId);
    if (!categories.some((c) => c.id === categoryId)) {
      return NextResponse.json({ error: "找不到這個分類" }, { status: 400 });
    }
    if (needsSubcategory(categories, categoryId)) {
      return NextResponse.json({ error: "這個分類底下還有項目，要選到項目才能套用" }, { status: 400 });
    }
    set.categoryId = categoryId;
  }

  // 帳戶：null 是合法值（改成不指定）；給了字串就一定要對得到自己現有的帳戶，
  // 對不到就擋下來，不要默默當成「不指定」——那會讓一整批紀錄的餘額莫名其妙少一截。
  if (body?.accountId !== undefined) {
    if (body.accountId === null) {
      set.accountId = null;
    } else {
      const accountId = typeof body.accountId === "string" ? body.accountId : "";
      const accounts = await listAccounts(userId);
      if (!accounts.some((a) => a.id === accountId)) {
        return NextResponse.json({ error: "找不到這個帳戶" }, { status: 400 });
      }
      set.accountId = accountId;
    }
  }

  if (Object.keys(set).length === 0) return NextResponse.json({ error: "沒有要修改的欄位" }, { status: 400 });

  const { updated, transactions } = await bulkUpdateTransactions(userId, ids, set);
  return NextResponse.json({ updated, transactions });
}
