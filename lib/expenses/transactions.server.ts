import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { TransactionDTO, TransactionInput } from "./transactions";

interface TransactionDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: ObjectId;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: Date;
}

function toDTO(doc: TransactionDoc): TransactionDTO {
  return { id: doc._id.toHexString(), categoryId: doc.categoryId.toHexString(), amount: doc.amount, date: doc.date, note: doc.note };
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
    amount: input.amount,
    date: input.date,
    note: input.note,
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
    { $set: { categoryId: new ObjectId(input.categoryId), amount: input.amount, date: input.date, note: input.note } },
  );
  return listTransactions(userId);
}

export async function deleteTransaction(userId: ObjectId, id: string): Promise<TransactionDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listTransactions(userId);
}

/** 匯入流程專用的批次新增——前端已經用 parseTransactionsCSV 驗證過格式，這裡只負責寫入。 */
export async function commitImportedTransactions(
  userId: ObjectId,
  rows: { categoryId: string; amount: number; date: string; note?: string }[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const col = await collection();
  const docs: TransactionDoc[] = rows.map((r) => ({
    _id: new ObjectId(),
    userId,
    categoryId: new ObjectId(r.categoryId),
    amount: r.amount,
    date: r.date,
    note: r.note,
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
