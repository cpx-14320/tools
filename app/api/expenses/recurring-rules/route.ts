import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import type { RecurrenceFrequencyUnit } from "@/lib/expenses/recurring-rules";
import {
  listRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  setRecurringRuleActive,
  deleteRecurringRule,
} from "@/lib/expenses/recurring-rules.server";

const FREQUENCY_UNITS: RecurrenceFrequencyUnit[] = ["day", "week", "month"];

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const rules = await listRecurringRules(new ObjectId(user.id));
  return NextResponse.json({ rules });
}

/** body 解析共用：新增／編輯都要驗證同一組欄位，各自用在 POST／PUT 的「整筆編輯」分支。
 *  回傳 null 代表欄位不合法，呼叫端直接回 400。 */
function parseRuleInput(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const categoryId = typeof b?.categoryId === "string" ? b.categoryId : "";
  const amount = Number(b?.amount);
  const note = typeof b?.note === "string" && b.note ? b.note : undefined;
  const frequencyUnit = typeof b?.frequencyUnit === "string" ? (b.frequencyUnit as RecurrenceFrequencyUnit) : undefined;
  const interval = Number(b?.interval ?? 1);
  const startDate = typeof b?.startDate === "string" ? b.startDate : "";
  // cycleCount 留空／0／負數都視為「沒填」＝無限期循環。
  const cycleCountRaw = Number(b?.cycleCount);
  const cycleCount = Number.isFinite(cycleCountRaw) && cycleCountRaw > 0 ? Math.floor(cycleCountRaw) : undefined;
  const linkedGoalId = typeof b?.linkedGoalId === "string" && b.linkedGoalId ? b.linkedGoalId : undefined;

  // 轉帳規則：有 transfer 就不需要 categoryId（轉帳不是支出也不是收入），但兩個帳戶
  // 一定要有、而且不能是同一個——轉給自己等於什麼都沒發生，每期還會生出一筆看不懂的
  // 紀錄。手續費跟手動轉帳同一個規則：0 或負數當成沒填。
  const rawTransfer = b?.transfer as Record<string, unknown> | undefined;
  const fromAccountId = typeof rawTransfer?.fromAccountId === "string" ? rawTransfer.fromAccountId : "";
  const toAccountId = typeof rawTransfer?.toAccountId === "string" ? rawTransfer.toAccountId : "";
  const rawFee = Number(rawTransfer?.fee);
  const transfer = rawTransfer
    ? { fromAccountId, toAccountId, fee: Number.isFinite(rawFee) && rawFee > 0 ? rawFee : undefined }
    : undefined;
  if (transfer && (!transfer.fromAccountId || !transfer.toAccountId || transfer.fromAccountId === transfer.toAccountId)) return null;

  if (
    (!categoryId && !transfer) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !frequencyUnit ||
    !FREQUENCY_UNITS.includes(frequencyUnit) ||
    !Number.isFinite(interval) ||
    interval < 1 ||
    !startDate
  ) {
    return null;
  }
  return { categoryId, transfer, amount, note, frequencyUnit, interval: Math.floor(interval), startDate, cycleCount, linkedGoalId };
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const input = parseRuleInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });

  const { rule, rules } = await createRecurringRule(new ObjectId(user.id), input);
  return NextResponse.json({ rule, rules });
}

/**
 * 同一支 route 依 body 形狀分兩種操作：
 * - body.active 是 boolean、且沒有其他編輯欄位 → 只切換啟用／暫停
 * - 其他 → 整筆編輯（分類／金額／頻率／起訖／連動目標）
 * 到期自動入帳不經過這支 route，是 lib/expenses/recurring-rules.server.ts 的
 * autoConfirmDueOccurrences 在進記帳本頁面時（app/tools/expenses/layout.tsx）直接呼叫。
 */
export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const b = body as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  if (typeof b?.active === "boolean" && b?.categoryId === undefined) {
    const rules = await setRecurringRuleActive(new ObjectId(user.id), id, b.active);
    return NextResponse.json({ rules });
  }

  const input = parseRuleInput(body);
  if (!input) return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  const rules = await updateRecurringRule(new ObjectId(user.id), id, input);
  return NextResponse.json({ rules });
}

export async function DELETE(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  const { rules, trashId } = await deleteRecurringRule(new ObjectId(user.id), id);
  return NextResponse.json({ rules, trashId });
}
