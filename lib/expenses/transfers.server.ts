import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { TransferDTO, TransferInput } from "./transfers";
import { putInTrash } from "./trash.server";
import { ensureFeeCategory } from "./categories.server";
import { formatDate } from "../format";

interface TransferDoc {
  _id: ObjectId;
  userId: ObjectId;
  fromAccountId: ObjectId;
  toAccountId: ObjectId;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  /** 手續費。實際的錢是記在另外一筆交易上（見 syncFeeTransaction），這裡存著是為了
   *  編輯轉帳時能把原本填的數字顯示回來。 */
  fee?: number;
  /** 只有「轉帳」類型的固定收支規則入帳時才會寫入。 */
  sourceRuleId?: ObjectId;
  createdAt: Date;
}

function toDTO(doc: TransferDoc): TransferDTO {
  return {
    id: doc._id.toHexString(),
    fromAccountId: doc.fromAccountId.toHexString(),
    toAccountId: doc.toAccountId.toHexString(),
    amount: doc.amount,
    date: doc.date,
    note: doc.note,
    fee: doc.fee,
    sourceRuleId: doc.sourceRuleId?.toHexString(),
  };
}

function collection() {
  return getDb().then((db) => db.collection<TransferDoc>("expenses.transfers"));
}

/** 手續費那一筆支出交易，跟著轉帳一起建立／更新／刪除。
 *
 *  **為什麼是獨立一筆交易而不是在轉帳上記一個數字**：手續費是真的花掉的錢，要能出現在
 *  支出報表、預算、帳戶餘額裡。只在轉帳文件上存一個 fee 欄位的話，每一個算餘額、算支出
 *  的地方都得額外知道「轉帳也可能扣錢」，漏一個地方就對不起來。
 *
 *  用 `sourceTransferId` 標記來源（跟固定收支的 sourceRuleId 同一個做法），所以轉帳改了
 *  金額或刪掉時找得回這一筆。手續費改成 0／清空就把那筆交易刪掉。 */
async function syncFeeTransaction(userId: ObjectId, transfer: TransferDoc): Promise<void> {
  const db = await getDb();
  const col = db.collection("expenses.transactions");
  const fee = transfer.fee ?? 0;

  if (fee <= 0) {
    await col.deleteMany({ userId, sourceTransferId: transfer._id });
    return;
  }

  const categoryId = await ensureFeeCategory(userId);
  // 掛在轉出的那個帳戶上：手續費是從轉出方扣的（跨行轉帳、ATM 提款都是這樣）。
  await col.updateOne(
    { userId, sourceTransferId: transfer._id },
    {
      $set: { categoryId, amount: fee, date: transfer.date, accountId: transfer.fromAccountId, note: "轉帳手續費" },
      $setOnInsert: { _id: new ObjectId(), userId, sourceTransferId: transfer._id, createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function listTransfers(userId: ObjectId): Promise<TransferDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ date: -1 }).toArray();
  return docs.map(toDTO);
}

export async function createTransfer(
  userId: ObjectId,
  input: TransferInput,
): Promise<{ transfer: TransferDTO; transfers: TransferDTO[] }> {
  const col = await collection();
  const doc: TransferDoc = {
    _id: new ObjectId(),
    userId,
    fromAccountId: new ObjectId(input.fromAccountId),
    toAccountId: new ObjectId(input.toAccountId),
    amount: input.amount,
    date: input.date,
    note: input.note,
    fee: input.fee,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  await syncFeeTransaction(userId, doc);
  const transfers = await listTransfers(userId);
  return { transfer: toDTO(doc), transfers };
}

export async function updateTransfer(userId: ObjectId, id: string, input: TransferInput): Promise<TransferDTO[]> {
  const col = await collection();
  const _id = new ObjectId(id);
  await col.updateOne(
    { _id, userId },
    {
      $set: {
        fromAccountId: new ObjectId(input.fromAccountId),
        toAccountId: new ObjectId(input.toAccountId),
        amount: input.amount,
        date: input.date,
        note: input.note,
        fee: input.fee,
      },
    },
  );
  // 改完再讀一次：手續費那筆交易的日期、帳戶、金額都要跟著轉帳走，拿更新後的文件去同步
  // 才不會用到舊值。
  const doc = await col.findOne({ _id, userId });
  if (doc) await syncFeeTransaction(userId, doc);
  return listTransfers(userId);
}

export async function deleteTransfer(userId: ObjectId, id: string): Promise<{ transfers: TransferDTO[]; trashId?: string }> {
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  if (!doc) return { transfers: await listTransfers(userId) };

  // 手續費那一筆支出跟著進垃圾桶，而且是同一個垃圾桶項目——它不是使用者自己記的交易，
  // 是這筆轉帳的附屬品，分成兩個項目的話還原時可能只還原一邊，帳就不平了。
  const db = await getDb();
  const feeDocs = await db.collection("expenses.transactions").find({ userId, sourceTransferId: doc._id }).toArray();

  const trashId = await putInTrash(userId, {
    kind: "transfer",
    label: doc.note?.trim() || "轉帳",
    sublabel: `${formatDate(doc.date)} · ${doc.amount}`,
    entries: [
      { collection: "expenses.transfers", doc },
      ...feeDocs.map((feeDoc) => ({ collection: "expenses.transactions", doc: feeDoc })),
    ],
  });
  await col.deleteOne({ _id: doc._id, userId });
  await db.collection("expenses.transactions").deleteMany({ userId, sourceTransferId: doc._id });
  return { transfers: await listTransfers(userId), trashId };
}
