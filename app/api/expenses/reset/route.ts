import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

/** 只清「記帳紀錄」——交易跟轉帳。分類、帳戶、帳戶類型、目標、固定收支、預算都留著，
 *  改完 CSV 可以直接重新匯入，不用從分類開始重建。 */
const RECORD_COLLECTIONS = ["expenses.transactions", "expenses.transfers"];

/** 清全部——連設定類的主檔一起清掉，回到剛開通這個工具的狀態。 */
const ALL_COLLECTIONS = [
  ...RECORD_COLLECTIONS,
  "expenses.categories",
  "expenses.accounts",
  "expenses.accountTypes",
  "expenses.goals",
  "expenses.recurringRules",
  "expenses.budgets",
];

/** 清除記帳本資料。只會刪掉目前登入這個使用者自己的資料（每個 collection 都帶 userId
 *  條件），不會動到別人的，也不會動到其他工具（transit.* 那些）。刪掉就沒了，沒有
 *  還原機制，所以畫面上要先讓使用者打字確認過才會呼叫這支。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const scope = body?.scope === "all" ? "all" : body?.scope === "records" ? "records" : null;
  if (!scope) return NextResponse.json({ error: "scope 只能是 records 或 all" }, { status: 400 });

  const userId = new ObjectId(user.id);
  const db = await getDb();
  const targets = scope === "all" ? ALL_COLLECTIONS : RECORD_COLLECTIONS;

  const deleted: Record<string, number> = {};
  for (const name of targets) {
    const result = await db.collection(name).deleteMany({ userId });
    deleted[name] = result.deletedCount;
  }

  return NextResponse.json({ scope, deleted, total: Object.values(deleted).reduce((sum, n) => sum + n, 0) });
}
