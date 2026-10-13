import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listCategories } from "@/lib/expenses/categories.server";
import { commitImportedTransactions, listTransactions } from "@/lib/expenses/transactions.server";

interface ImportRow {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
}

/** 日期、分類、金額、備註完全一樣就視為同一筆——用來跟現有紀錄比對、也用來抓同一份
 *  CSV 裡自己重複的列，不是比對 _id（匯入的資料本來就沒有 id）。 */
function dedupeKey(t: ImportRow): string {
  return `${t.date}|${t.categoryId}|${t.amount}|${t.note ?? ""}`;
}

/** 匯入頁已經用 parseTransactionsCSV 在前端驗證、解析過一次，這裡用使用者自己目前的分類清單
 *  重新核對一次分類 id 真的存在（分類可能在預覽之後、確認匯入之前被刪掉），再批次寫入。
 *  寫入前會跟使用者現有的消費紀錄比對一次，日期/分類/金額/備註完全相同的列視為重複、
 *  略過不新增（同一份 CSV 裡列與列之間重複也會抓出來，只留第一筆）。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const rows: unknown[] | null = Array.isArray(body?.rows) ? (body.rows as unknown[]) : null;
  if (!rows) return NextResponse.json({ error: "缺少 rows" }, { status: 400 });

  const userId = new ObjectId(user.id);
  const categories = await listCategories(userId);
  const categoryIds = new Set(categories.map((c) => c.id));

  const valid = rows.filter((row): row is ImportRow => {
    const r = row as { categoryId?: unknown; amount?: unknown; date?: unknown };
    return (
      typeof r.categoryId === "string" &&
      categoryIds.has(r.categoryId) &&
      Number.isFinite(Number(r.amount)) &&
      Number(r.amount) > 0 &&
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date)
    );
  });

  const existing = await listTransactions(userId);
  const seen = new Set(existing.map(dedupeKey));
  const toInsert: ImportRow[] = [];
  let duplicates = 0;
  for (const row of valid) {
    const key = dedupeKey(row);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    toInsert.push(row);
  }

  const count = await commitImportedTransactions(userId, toInsert);
  return NextResponse.json({ count, duplicates });
}
