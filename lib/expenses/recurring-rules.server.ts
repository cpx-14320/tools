import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { occurrencesUpTo, type RecurringRuleDTO, type RecurringRuleInput, type RecurringTransfer } from "./recurring-rules";
import { contributeToGoal } from "./goals.server";
import { ensureFeeCategory } from "./categories.server";

/** 轉帳規則在資料庫裡的樣子。帳戶存 ObjectId（跟 expenses.transfers 一致），手續費存數字。 */
interface RecurringTransferDoc {
  fromAccountId: ObjectId;
  toAccountId: ObjectId;
  fee?: number;
}

interface RecurringRuleDoc {
  _id: ObjectId;
  userId: ObjectId;
  /** 轉帳規則沒有分類；那種規則這個欄位不存在。 */
  categoryId?: ObjectId;
  /** 有值＝轉帳規則（見 recurring-rules.ts 的 RecurringTransfer）。 */
  transfer?: RecurringTransferDoc;
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
    // 轉帳規則沒有分類，給空字串——DTO 的消費端（分類路徑、圖示）本來就要處理「查不到
    // 分類」這種情況，多一個 undefined 的分支只是讓每個呼叫點都得多判斷一次。
    categoryId: doc.categoryId?.toHexString() ?? "",
    transfer: doc.transfer && {
      fromAccountId: doc.transfer.fromAccountId.toHexString(),
      toAccountId: doc.transfer.toAccountId.toHexString(),
      fee: doc.transfer.fee,
    },
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

function toTransferDoc(input: RecurringTransfer): RecurringTransferDoc {
  return {
    fromAccountId: new ObjectId(input.fromAccountId),
    toAccountId: new ObjectId(input.toAccountId),
    fee: input.fee && input.fee > 0 ? input.fee : undefined,
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
    // 兩種規則互斥：轉帳的沒有 categoryId，收支的沒有 transfer。
    ...(input.transfer ? { transfer: toTransferDoc(input.transfer) } : { categoryId: new ObjectId(input.categoryId) }),
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
        ...(input.transfer ? { transfer: toTransferDoc(input.transfer) } : { categoryId: new ObjectId(input.categoryId) }),
        amount: input.amount,
        note: input.note,
        frequencyUnit: input.frequencyUnit,
        interval: input.interval,
        startDate: input.startDate,
        cycleCount: input.cycleCount,
        linkedGoalId: input.linkedGoalId ? new ObjectId(input.linkedGoalId) : undefined,
      },
      // 在兩種類型之間改來改去時，另一邊的欄位要拿掉——留著的話一條規則同時有
      // categoryId 跟 transfer，confirmOneOccurrence 就分不出該寫出交易還是轉帳。
      $unset: input.transfer ? { categoryId: "" } : { transfer: "" },
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
export async function deleteRecurringRule(userId: ObjectId, id: string): Promise<{ rules: RecurringRuleDTO[]; trashId?: string }> {
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  if (!doc) return { rules: await listRecurringRules(userId) };

  // **刻意不進垃圾桶**（理由同 goals.server.ts 的 deleteGoal）：規則是設定不是紀錄，
  // 而且已經入帳過的交易是獨立快照、不會跟著消失，真正會不見的只有「往後還沒發生的
  // 期數」——那本來就是重建一條規則就有的東西。
  await col.deleteOne({ _id: doc._id, userId });
  return { rules: await listRecurringRules(userId) };
}

/** 這條規則目前已經入帳的那幾期——key 是發生日期（YYYY-MM-DD），value 是對應的
 *  expenses.transactions _id。用來跟 lib/expenses/recurring-rules.ts 的 occurrenceStatuses
 *  比對出「已入帳 vs 還沒入帳」。 */
async function listConfirmedOccurrences(userId: ObjectId, ruleId: string): Promise<Map<string, string>> {
  const db = await getDb();
  // 兩個 collection 都要查：收支規則入帳成交易，轉帳規則入帳成轉帳。只查 transactions
  // 的話，轉帳規則的每一期永遠都算「還沒入帳」，待確認清單會無限重複同一期。
  const [txs, transfers] = await Promise.all([
    db.collection("expenses.transactions").find({ userId, sourceRuleId: new ObjectId(ruleId) }, { projection: { date: 1 } }).toArray(),
    db.collection("expenses.transfers").find({ userId, sourceRuleId: new ObjectId(ruleId) }, { projection: { date: 1 } }).toArray(),
  ]);
  return new Map([...txs, ...transfers].map((d) => [d.date as string, (d._id as ObjectId).toHexString()]));
}

/** 把一期固定收支變成一筆獨立的 expenses.transactions 紀錄——複製規則目前的金額／分類／
 *  備註，帶 sourceRuleId 純粹做來源標記，之後規則不管怎麼改、甚至被刪除，這筆交易都不受
 *  影響。有連著存錢目標的話，同一期也把金額計入目標進度。重複呼叫同一條規則同一天會撞
 *  唯一索引（ensureIndexes），這裡吞掉 duplicate key 錯誤，呼叫端不用自己擋重複。 */
async function confirmOneOccurrence(userId: ObjectId, rule: RecurringRuleDoc, occurrenceDate: string): Promise<void> {
  const db = await getDb();

  // 轉帳規則寫出的是一筆轉帳，不是交易——轉帳不是支出也不是收入，走 transactions 那條路
  // 會讓每個月的房租轉存被算進支出統計裡。擋重複靠 expenses.transfers 上的唯一索引
  // （userId + sourceRuleId + date，見 lib/mongodb.ts），跟交易那邊同一招。
  if (rule.transfer) {
    const transferId = new ObjectId();
    try {
      await db.collection("expenses.transfers").insertOne({
        _id: transferId,
        userId,
        fromAccountId: rule.transfer.fromAccountId,
        toAccountId: rule.transfer.toAccountId,
        amount: rule.amount,
        date: occurrenceDate,
        note: rule.note,
        fee: rule.transfer.fee,
        sourceRuleId: rule._id,
        createdAt: new Date(),
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return; // 已經入帳過，當作沒事發生
      throw err;
    }
    // 手續費那一筆支出：跟手動記一筆轉帳走同一套（掛「手續費」分類、從轉出帳戶扣），
    // 不然每期被扣掉的錢會憑空蒸發。
    if (rule.transfer.fee && rule.transfer.fee > 0) {
      const categoryId = await ensureFeeCategory(userId);
      await db.collection("expenses.transactions").insertOne({
        _id: new ObjectId(),
        userId,
        categoryId,
        amount: rule.transfer.fee,
        date: occurrenceDate,
        accountId: rule.transfer.fromAccountId,
        note: "轉帳手續費",
        sourceTransferId: transferId,
        createdAt: new Date(),
      });
    }
    return;
  }

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

export interface PendingOccurrence {
  ruleId: string;
  /** 轉帳規則是空字串。 */
  categoryId: string;
  /** 有值＝這一期要寫出的是一筆轉帳。 */
  transfer?: RecurringTransfer;
  amount: number;
  note?: string;
  date: string;
}

/** 已經到期、但還沒入帳也還沒被略過的那幾期。
 *
 *  以前這些是在使用者每次打開記帳本時自動寫進交易紀錄的（autoConfirmDueOccurrences，
 *  已移除）。問題是「固定」收支其實沒那麼固定——電話費每個月金額不一樣、這個月房東
 *  調租、某個月根本沒扣款，自動入帳會默默生出跟實際不符的紀錄，而且使用者不會發現。
 *  改成列出來等使用者按確認，才有機會在入帳前改金額或直接略過。 */
export async function listPendingOccurrences(
  userId: ObjectId,
): Promise<PendingOccurrence[]> {
  const col = await collection();
  const rules = await col.find({ userId, active: true }).toArray();
  if (rules.length === 0) return [];

  const today = todayInTaipei();
  const out: PendingOccurrence[] = [];
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
        categoryId: rule.categoryId?.toHexString() ?? "",
        transfer: rule.transfer && {
          fromAccountId: rule.transfer.fromAccountId.toHexString(),
          toAccountId: rule.transfer.toAccountId.toHexString(),
          fee: rule.transfer.fee,
        },
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
