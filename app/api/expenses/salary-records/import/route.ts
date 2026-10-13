import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listSalaryItemTypes } from "@/lib/expenses/salary-types.server";
import { createSalaryRecord } from "@/lib/expenses/salary-records.server";

interface ImportGroup {
  yearMonth: string;
  items: { typeId: string; amount: number }[];
}

function parseGroups(body: unknown): ImportGroup[] | null {
  const records = (body as { records?: unknown })?.records;
  if (!Array.isArray(records)) return null;
  const groups: ImportGroup[] = [];
  for (const r of records) {
    const yearMonth = (r as { yearMonth?: unknown })?.yearMonth;
    const items = (r as { items?: unknown })?.items;
    if (typeof yearMonth !== "string" || !/^\d{4}-\d{2}$/.test(yearMonth) || !Array.isArray(items)) return null;
    const parsedItems: { typeId: string; amount: number }[] = [];
    for (const item of items) {
      const typeId = (item as { typeId?: unknown })?.typeId;
      const amount = Number((item as { amount?: unknown })?.amount);
      if (typeof typeId !== "string" || !Number.isFinite(amount) || amount <= 0) return null;
      parsedItems.push({ typeId, amount });
    }
    if (parsedItems.length === 0) return null;
    groups.push({ yearMonth, items: parsedItems });
  }
  return groups;
}

/** 匯入頁已經用 parseSalaryItemsCSV／groupSalaryItemsByMonth 在前端驗證、分組過一次，這裡
 *  用使用者自己目前的薪資明細類型重新核對一次 typeId 真的存在，再逐月嘗試新增——哪個月份
 *  已經有紀錄（唯一索引擋下來）就略過，不會覆蓋既有資料，回傳哪些月份新增成功、哪些被略過。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const groups = parseGroups(body);
  if (!groups) return NextResponse.json({ error: "缺少 records" }, { status: 400 });

  const userId = new ObjectId(user.id);
  const types = await listSalaryItemTypes(userId);
  const typeIds = new Set(types.map((t) => t.id));

  const created: string[] = [];
  const skipped: string[] = [];
  for (const group of groups) {
    const validItems = group.items.filter((i) => typeIds.has(i.typeId));
    if (validItems.length === 0) {
      skipped.push(group.yearMonth);
      continue;
    }
    const result = await createSalaryRecord(userId, group.yearMonth, validItems);
    if ("error" in result) skipped.push(group.yearMonth);
    else created.push(group.yearMonth);
  }

  return NextResponse.json({ created, skipped });
}
