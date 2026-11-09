import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { confirmOccurrences, listPendingOccurrences, skipOccurrences } from "@/lib/expenses/recurring-rules.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

/** 已經到期、等使用者確認的那幾期固定收支。 */
export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const pending = await listPendingOccurrences(new ObjectId(user.id));
  return NextResponse.json({ pending });
}

/** 確認或略過。body：`{ action: "confirm" | "skip", items: [{ ruleId, date, amount? }] }`
 *
 *  一次送一批（整批確認那顆按鈕會把全部送進來），回傳更新後的待確認清單、交易紀錄跟
 *  轉帳紀錄，呼叫端不用再多打幾支 API 重抓。轉帳那一份是因為「轉帳」類型的規則入帳成的
 *  是轉帳而不是交易，固定收支頁要靠它算「已入帳幾期」。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const rawItems: unknown = body?.items;
  if ((action !== "confirm" && action !== "skip") || !Array.isArray(rawItems)) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }

  const items = rawItems.flatMap((it) => {
    const ruleId = typeof it?.ruleId === "string" && ObjectId.isValid(it.ruleId) ? it.ruleId : null;
    const date = typeof it?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : null;
    if (!ruleId || !date) return [];
    // 金額只在確認時可以覆寫，而且要是有限的非負數；沒送或不合法就用規則本身的金額。
    const amount = typeof it?.amount === "number" && Number.isFinite(it.amount) && it.amount >= 0 ? it.amount : undefined;
    return [{ ruleId, date, amount }];
  });
  if (items.length === 0) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const userId = new ObjectId(user.id);
  if (action === "confirm") await confirmOccurrences(userId, items);
  else await skipOccurrences(userId, items);

  const [pending, transactions, transfers] = await Promise.all([
    listPendingOccurrences(userId),
    listTransactions(userId),
    listTransfers(userId),
  ]);
  return NextResponse.json({ pending, transactions, transfers });
}
