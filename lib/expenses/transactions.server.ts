import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { breakdownNet, type BreakdownItem, type TransactionDTO, type TransactionInput } from "./transactions";
import { putInTrash } from "./trash.server";
import { formatDate } from "../format";
import type { CategoryColor } from "./categories";

interface TransactionDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: ObjectId;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  // 只有固定收支規則確認存入時才會寫入（見 recurring-rules.server.ts 的 confirmOccurrence），
  // 一般的新增／編輯／CSV 匯入路徑都不會碰這個欄位。
  sourceRuleId?: ObjectId;
  /** 只有「轉帳手續費」那種附屬交易才會寫入（見 transfers.server.ts 的
   *  syncFeeTransaction）。一般的新增／編輯／CSV 匯入路徑都不會碰這個欄位，手續費也
   *  因此不會在使用者改轉帳金額之後變成一筆對不起來的孤兒支出。 */
  sourceTransferId?: ObjectId;
  breakdown?: BreakdownItem[];
  accountId?: ObjectId;
  createdAt: Date;
}

function toDTO(doc: TransactionDoc): TransactionDTO {
  return {
    id: doc._id.toHexString(),
    categoryId: doc.categoryId.toHexString(),
    amount: doc.amount,
    date: doc.date,
    note: doc.note,
    sourceRuleId: doc.sourceRuleId?.toHexString(),
    breakdown: doc.breakdown,
    accountId: doc.accountId?.toHexString(),
  };
}

/** 有填明細的話，金額一律是明細算出來的淨額，不信任前端傳來的 amount——避免前端算錯
 *  或被竄改之後，總額跟明細兜不起來。 */
function resolveAmount(input: TransactionInput): number {
  return input.breakdown && input.breakdown.length > 0 ? breakdownNet(input.breakdown) : input.amount;
}

function collection() {
  return getDb().then((db) => db.collection<TransactionDoc>("expenses.transactions"));
}

/** 一次撈該使用者全部消費紀錄，交給前端依日期篩選器／搜尋框自行篩——帳本是個人使用，
 *  筆數規模不需要伺服器端分頁，搜尋也才能像原本的設計一樣「不限篩選區間」。 */
export async function listTransactions(userId: ObjectId): Promise<TransactionDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ date: -1 }).toArray();
  return docs.map(toDTO);
}

export async function createTransaction(
  userId: ObjectId,
  input: TransactionInput,
): Promise<{ transaction: TransactionDTO; transactions: TransactionDTO[] }> {
  const col = await collection();
  const doc: TransactionDoc = {
    _id: new ObjectId(),
    userId,
    categoryId: new ObjectId(input.categoryId),
    amount: resolveAmount(input),
    date: input.date,
    note: input.note,
    breakdown: input.breakdown,
    accountId: input.accountId ? new ObjectId(input.accountId) : undefined,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const transactions = await listTransactions(userId);
  return { transaction: toDTO(doc), transactions };
}

export async function updateTransaction(userId: ObjectId, id: string, input: TransactionInput): Promise<TransactionDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        categoryId: new ObjectId(input.categoryId),
        amount: resolveAmount(input),
        date: input.date,
        note: input.note,
        breakdown: input.breakdown,
        accountId: input.accountId ? new ObjectId(input.accountId) : undefined,
      },
    },
  );
  return listTransactions(userId);
}

/** 刪一筆交易。先原封不動搬進垃圾桶再真的刪掉——還原時用原本的 _id 插回去，所以
 *  指向它的東西（例如固定收支的已入帳紀錄）會自動接回來。回傳 trashId 給 Undo 用。 */
export async function deleteTransaction(userId: ObjectId, id: string): Promise<{ transactions: TransactionDTO[]; trashId?: string }> {
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  if (!doc) return { transactions: await listTransactions(userId) };

  // 圖示跟顏色也在這裡抓起來存——理由同 label：垃圾桶那一列要畫得跟它被刪之前一樣，
  // 但分類之後可能也被刪掉，到時候就反查不到了。
  const db = await getDb();
  const category = await db.collection<{ icon?: string; color?: CategoryColor }>("expenses.categories").findOne({ _id: doc.categoryId, userId });
  const trashId = await putInTrash(userId, {
    kind: "transaction",
    // 標籤在刪除當下就算好存起來：分類之後可能也被刪掉，到時候反查不到名字。
    label: doc.note?.trim() || "（沒有備註）",
    sublabel: `${formatDate(doc.date)} · ${doc.amount}`,
    icon: category?.icon,
    color: category?.color,
    entries: [{ collection: "expenses.transactions", doc }],
  });
  await col.deleteOne({ _id: doc._id, userId });
  return { transactions: await listTransactions(userId), trashId };
}

/** 批次只改「掛在哪個分類／哪個帳戶」，不碰金額、日期、備註、明細。
 *
 *  給明細頁的多選模式用：最常見的情境是一開始沒指定帳戶，後來想一次補上一整批
 *  （篩「只看未指定帳戶」→ 全選 → 改帳戶）；一筆一筆開彈窗改五十次不是辦法。
 *
 *  `accountId` 三種值意義不同，不能混：
 *    - `undefined`  不要動這個欄位
 *    - `null`       改成「不指定帳戶」
 *    - 字串          改成那個帳戶
 *  分類沒有「清空」這種事（每筆交易一定屬於某個分類），所以 categoryId 只有
 *  「不要動」跟「改成這個」兩種。
 *
 *  只更新 `_id ∈ ids` **而且** `userId` 是自己的那幾筆——id 是前端送來的，不能信。
 *  回傳實際改到幾筆：中途被別的裝置刪掉的那幾筆不會算進去，畫面上的提示才不會
 *  報一個比實際多的數字。 */
export async function bulkUpdateTransactions(
  userId: ObjectId,
  ids: string[],
  set: { categoryId?: string; accountId?: string | null },
): Promise<{ updated: number; transactions: TransactionDTO[] }> {
  const objectIds = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  const update: Record<string, unknown> = {};
  if (set.categoryId) update.categoryId = new ObjectId(set.categoryId);
  // undefined 會被 mongo driver 序列化成 null（見 lib/expenses 的既知坑），這裡正好
  // 就是要 null＝不指定帳戶，所以直接寫進去沒問題。
  if (set.accountId !== undefined) update.accountId = set.accountId ? new ObjectId(set.accountId) : undefined;

  if (objectIds.length === 0 || Object.keys(update).length === 0) {
    return { updated: 0, transactions: await listTransactions(userId) };
  }

  const col = await collection();
  const result = await col.updateMany({ _id: { $in: objectIds }, userId }, { $set: update });
  return { updated: result.modifiedCount, transactions: await listTransactions(userId) };
}

/** 匯入流程專用的批次新增——前端已經用 parseTransactionsCSV 驗證過格式、API route 再
 *  驗一次，這裡只負責寫入。有帶明細的話金額一律以明細淨額為準（跟 createTransaction
 *  的 resolveAmount 同一個規則），不信任 CSV 裡那個可能跟明細兜不起來的總額。 */
export async function commitImportedTransactions(
  userId: ObjectId,
  rows: { categoryId: string; amount: number; date: string; note?: string; breakdown?: BreakdownItem[]; accountId?: string }[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const col = await collection();
  const docs: TransactionDoc[] = rows.map((r) => ({
    _id: new ObjectId(),
    userId,
    categoryId: new ObjectId(r.categoryId),
    amount: r.breakdown && r.breakdown.length > 0 ? breakdownNet(r.breakdown) : r.amount,
    date: r.date,
    note: r.note,
    breakdown: r.breakdown,
    accountId: r.accountId ? new ObjectId(r.accountId) : undefined,
    createdAt: new Date(),
  }));
  const result = await col.insertMany(docs);
  return result.insertedCount;
}

/** 每個分類（含子分類）目前有幾筆消費紀錄——分類管理頁顯示筆數用，不受日期篩選器影響。 */
export async function countByCategory(userId: ObjectId): Promise<Record<string, number>> {
  const col = await collection();
  const rows = await col
    .aggregate<{ _id: ObjectId; count: number }>([{ $match: { userId } }, { $group: { _id: "$categoryId", count: { $sum: 1 } } }])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id.toHexString(), r.count]));
}
