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
  confirmOccurrence,
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

  if (
    !categoryId ||
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
  return { categoryId, amount, note, frequencyUnit, interval: Math.floor(interval), startDate, cycleCount };
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
 * 同一支 route 依 body 形狀分三種操作（跟 goals route 同一套風格）：
 * - body.confirmDate 有值 → 確認存入這一期，變成一筆真正的交易紀錄
 * - body.active 是 boolean、且沒有其他編輯欄位 → 只切換啟用／暫停
 * - 其他 → 整筆編輯（分類／金額／頻率／起訖）
 */
export async function PUT(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const b = body as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  if (typeof b?.confirmDate === "string" && b.confirmDate) {
    try {
      const { rules, transactionId } = await confirmOccurrence(new ObjectId(user.id), id, b.confirmDate);
      return NextResponse.json({ rules, transactionId });
    } catch (err) {
      // 重複確認同一天會撞唯一索引；找不到規則是 confirmOccurrence 自己丟的 Error。
      const message = err instanceof Error ? err.message : "確認存入失敗";
      return NextResponse.json({ error: message.includes("duplicate") ? "這一期已經確認存入過了" : message }, { status: 400 });
    }
  }

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

  const rules = await deleteRecurringRule(new ObjectId(user.id), id);
  return NextResponse.json({ rules });
}
