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
  /** 使用者按「略過」的那幾期（發生日期 YYYY-MM-DD）。略過＝這一期不入帳、也不要再
   *  出現在待確認清單裡（那個月剛好停用電話、沒繳房租…）。沒有這個欄位的話，不想要的
   *  那一期會一直掛在待確認區催下去。 */
  skippedDates?: string[];
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
async function listConfirmedOccurrences(userId: ObjectId, ruleId: string): Promise<Map<string, string>> {
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

/** 已經到期、但還沒入帳也還沒被略過的那幾期。
 *
 *  以前這些是在使用者每次打開記帳本時自動寫進交易紀錄的（autoConfirmDueOccurrences，
 *  已移除）。問題是「固定」收支其實沒那麼固定——電話費每個月金額不一樣、這個月房東
 *  調租、某個月根本沒扣款，自動入帳會默默生出跟實際不符的紀錄，而且使用者不會發現。
 *  改成列出來等使用者按確認，才有機會在入帳前改金額或直接略過。 */
export async function listPendingOccurrences(
  userId: ObjectId,
): Promise<{ ruleId: string; categoryId: string; amount: number; note?: string; date: string }[]> {
  const col = await collection();
  const rules = await col.find({ userId, active: true }).toArray();
  if (rules.length === 0) return [];

  const today = todayInTaipei();
  const out: { ruleId: string; categoryId: string; amount: number; note?: string; date: string }[] = [];
  for (const rule of rules) {
    const confirmed = await listConfirmedOccurrences(userId, rule._id.toHexString());
    const skipped = new Set(rule.skippedDates ?? []);
    for (const occ of occurrencesUpTo(
      { startDate: rule.startDate, frequencyUnit: rule.frequencyUnit, interval: rule.interval, cycleCount: rule.cycleCount },
      today,
    )) {
      if (confirmed.has(occ.date) || skipped.has(occ.date)) continue;
      out.push({
        ruleId: rule._id.toHexString(),
        categoryId: rule.categoryId.toHexString(),
        amount: rule.amount,
        note: rule.note,
        date: occ.date,
      });
    }
  }
  // 舊的排前面：補好幾個月的時候，由遠到近一期一期確認比較符合直覺。
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** 確認其中幾期，真正寫成交易紀錄。
 *
 *  `amount` 可以由呼叫端覆寫——待確認清單上可以當場改金額（這個月電話費比較貴），
 *  改過的值只影響這一筆交易，規則本身的預設金額不動。 */
export async function confirmOccurrences(
  userId: ObjectId,
  items: { ruleId: string; date: string; amount?: number }[],
): Promise<void> {
  const col = await collection();
  for (const item of items) {
    const rule = await col.findOne({ _id: new ObjectId(item.ruleId), userId });
    if (!rule) continue;
    await confirmOneOccurrence(userId, { ...rule, amount: item.amount ?? rule.amount }, item.date);
  }
}

/** 略過其中幾期——不入帳，也不再出現在待確認清單。$addToSet 所以重複按不會長出重複值。 */
export async function skipOccurrences(userId: ObjectId, items: { ruleId: string; date: string }[]): Promise<void> {
  const col = await collection();
  for (const item of items) {
    await col.updateOne({ _id: new ObjectId(item.ruleId), userId }, { $addToSet: { skippedDates: item.date } });
  }
}
