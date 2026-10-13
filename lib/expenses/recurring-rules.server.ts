import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { RecurringRuleDTO, RecurringRuleInput } from "./recurring-rules";

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
  };
}

function collection() {
  return getDb().then((db) => db.collection<RecurringRuleDoc>("expenses.recurringRules"));
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
      },
    },
  );
  return listRecurringRules(userId);
}

/** 暫停／恢復規則，不刪除——暫停後往後不會再被提示新的待確認期數，但已經確認過的交易
 *  紀錄不受影響（那些是獨立快照，見 recurring-rules.ts 開頭的說明）。 */
export async function setRecurringRuleActive(userId: ObjectId, id: string, active: boolean): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: { active } });
  return listRecurringRules(userId);
}

/** 刪除規則本身——已經確認存入的交易紀錄是獨立快照，不會被這個操作動到；還沒確認的
 *  期數本來就不是資料庫裡真的存在的資料（都是即時算出來的），刪除後自然就不會再被
 *  提示，等同於「提前解約，之後的期數不用再管」。 */
export async function deleteRecurringRule(userId: ObjectId, id: string): Promise<RecurringRuleDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listRecurringRules(userId);
}

/** 這條規則目前已經確認存入的那幾期——key 是發生日期（YYYY-MM-DD），value 是對應的
 *  expenses.transactions _id。用來跟 lib/expenses/recurring-rules.ts 的 occurrenceStatuses
 *  比對出「已存入 vs 還沒存入」。 */
export async function listConfirmedOccurrences(userId: ObjectId, ruleId: string): Promise<Map<string, string>> {
  const db = await getDb();
  const docs = await db
    .collection("expenses.transactions")
    .find({ userId, sourceRuleId: new ObjectId(ruleId) }, { projection: { date: 1 } })
    .toArray();
  return new Map(docs.map((d) => [d.date as string, (d._id as ObjectId).toHexString()]));
}

export interface ConfirmOccurrenceResult {
  rules: RecurringRuleDTO[];
  transactionId: string;
}

/** 使用者按下「確認存入」——把規則目前的金額／分類／備註複製成一筆獨立的
 *  expenses.transactions 紀錄，帶 sourceRuleId 純粹做來源標記（畫面可以顯示來自哪條
 *  規則），之後規則不管怎麼改、甚至被刪除，這筆交易都不受影響。同一條規則同一天只能
 *  確認一次，靠 ensureIndexes 裡的唯一索引擋重複送出。 */
export async function confirmOccurrence(userId: ObjectId, ruleId: string, occurrenceDate: string): Promise<ConfirmOccurrenceResult> {
  const col = await collection();
  const rule = await col.findOne({ _id: new ObjectId(ruleId), userId });
  if (!rule) throw new Error("找不到這條固定收支規則");

  const db = await getDb();
  const txId = new ObjectId();
  await db.collection("expenses.transactions").insertOne({
    _id: txId,
    userId,
    categoryId: rule.categoryId,
    amount: rule.amount,
    date: occurrenceDate,
    note: rule.note,
    sourceRuleId: rule._id,
    createdAt: new Date(),
  });

  const rules = await listRecurringRules(userId);
  return { rules, transactionId: txId.toHexString() };
}
