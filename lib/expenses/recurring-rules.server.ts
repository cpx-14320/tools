import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { occurrencesUpTo, type RecurringRuleDTO, type RecurringRuleInput } from "./recurring-rules";
import { contributeToGoal } from "./goals.server";

interface RecurringRuleDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: ObjectId;
  amount: number;
  note?: string;
  frequencyUnit: RecurringRuleDTO["frequencyUnit"];
  interval: number;
  startDate: string;
  cycleCount?: number;
  active: boolean;
  linkedGoalId?: ObjectId;
  createdAt: Date;
}

function toDTO(doc: RecurringRuleDoc): RecurringRuleDTO {
  return {
    id: doc._id.toHexString(),
    categoryId: doc.categoryId.toHexString(),
    amount: doc.amount,
    note: doc.note,
    frequencyUnit: doc.frequencyUnit,
    interval: doc.interval,
    startDate: doc.startDate,
    cycleCount: doc.cycleCount,
    active: doc.active,
    linkedGoalId: doc.linkedGoalId?.toHexString(),
  };
}

function collection() {
  return getDb().then((db) => db.collection<RecurringRuleDoc>("expenses.recurringRules"));
}

function todayInTaipei(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export async function listRecurringRules(userId: ObjectId): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ createdAt: 1 }).toArray();
  return docs.map(toDTO);
}

export async function createRecurringRule(
  userId: ObjectId,
  input: RecurringRuleInput,
): Promise<{ rule: RecurringRuleDTO; rules: RecurringRuleDTO[] }> {
  const col = await collection();
  const doc: RecurringRuleDoc = {
    _id: new ObjectId(),
    userId,
    categoryId: new ObjectId(input.categoryId),
    amount: input.amount,
    note: input.note,
    frequencyUnit: input.frequencyUnit,
    interval: input.interval,
    startDate: input.startDate,
    cycleCount: input.cycleCount,
    active: true,
    linkedGoalId: input.linkedGoalId ? new ObjectId(input.linkedGoalId) : undefined,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const rules = await listRecurringRules(userId);
  return { rule: toDTO(doc), rules };
}

export async function updateRecurringRule(userId: ObjectId, id: string, input: RecurringRuleInput): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        categoryId: new ObjectId(input.categoryId),
        amount: input.amount,
        note: input.note,
        frequencyUnit: input.frequencyUnit,
        interval: input.interval,
        startDate: input.startDate,
        cycleCount: input.cycleCount,
        linkedGoalId: input.linkedGoalId ? new ObjectId(input.linkedGoalId) : undefined,
      },
    },
  );
  return listRecurringRules(userId);
}

/** 暫停／恢復規則，不刪除——暫停後往後不會再被自動入帳，但已經入帳過的交易紀錄不受
 *  影響（那些是獨立快照，見 recurring-rules.ts 開頭的說明）。 */
export async function setRecurringRuleActive(userId: ObjectId, id: string, active: boolean): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: { active } });
  return listRecurringRules(userId);
}

/** 刪除規則本身——已經自動入帳的交易紀錄是獨立快照，不會被這個操作動到；還沒到期的
 *  期數本來就不是資料庫裡真的存在的資料（都是即時算出來的），刪除後自然就不會再被
 *  入帳，等同於「提前解約，之後的期數不用再管」。 */
export async function deleteRecurringRule(userId: ObjectId, id: string): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listRecurringRules(userId);
}

/** 這條規則目前已經入帳的那幾期——key 是發生日期（YYYY-MM-DD），value 是對應的
 *  expenses.transactions _id。用來跟 lib/expenses/recurring-rules.ts 的 occurrenceStatuses
 *  比對出「已入帳 vs 還沒入帳」。 */
export async function listConfirmedOccurrences(userId: ObjectId, ruleId: string): Promise<Map<string, string>> {
  const db = await getDb();
  const docs = await db
    .collection("expenses.transactions")
    .find({ userId, sourceRuleId: new ObjectId(ruleId) }, { projection: { date: 1 } })
    .toArray();
  return new Map(docs.map((d) => [d.date as string, (d._id as ObjectId).toHexString()]));
}

/** 把一期固定收支變成一筆獨立的 expenses.transactions 紀錄——複製規則目前的金額／分類／
 *  備註，帶 sourceRuleId 純粹做來源標記，之後規則不管怎麼改、甚至被刪除，這筆交易都不受
 *  影響。有連著存錢目標的話，同一期也把金額計入目標進度。重複呼叫同一條規則同一天會撞
 *  唯一索引（ensureIndexes），這裡吞掉 duplicate key 錯誤，呼叫端不用自己擋重複。 */
async function confirmOneOccurrence(userId: ObjectId, rule: RecurringRuleDoc, occurrenceDate: string): Promise<void> {
  const db = await getDb();
  try {
    await db.collection("expenses.transactions").insertOne({
      _id: new ObjectId(),
      userId,
      categoryId: rule.categoryId,
      amount: rule.amount,
      date: occurrenceDate,
      note: rule.note,
      sourceRuleId: rule._id,
      createdAt: new Date(),
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return; // 已經入帳過，當作沒事發生
    throw err;
  }
  if (rule.linkedGoalId) {
    await contributeToGoal(userId, rule.linkedGoalId.toHexString(), rule.amount);
  }
}

/** 固定收支到期自動入帳——由 app/tools/expenses/layout.tsx 在使用者每次進入記帳本任何
 *  頁面時呼叫，不是靠真的排程器。多久沒開都沒關係，缺的那幾期會一次全部依序補齊；
 *  沒有任何到期但還沒入帳的期數就完全不寫資料庫。 */
export async function autoConfirmDueOccurrences(userId: ObjectId): Promise<void> {
  const col = await collection();
  const rules = await col.find({ userId, active: true }).toArray();
  if (rules.length === 0) return;

  const today = todayInTaipei();
  for (const rule of rules) {
    const confirmed = await listConfirmedOccurrences(userId, rule._id.toHexString());
    const pending = occurrencesUpTo(
      { startDate: rule.startDate, frequencyUnit: rule.frequencyUnit, interval: rule.interval, cycleCount: rule.cycleCount },
      today,
    ).filter((occ) => !confirmed.has(occ.date));
    for (const occ of pending) {
      await confirmOneOccurrence(userId, rule, occ.date);
    }
  }
}
