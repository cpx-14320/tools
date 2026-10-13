import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { SalaryRecordDTO, SalaryRecordItem } from "./salary-records";

interface SalaryRecordDoc {
  _id: ObjectId;
  userId: ObjectId;
  yearMonth: string; // YYYY-MM
  items: { typeId: ObjectId; amount: number }[];
  createdAt: Date;
}

function toDTO(doc: SalaryRecordDoc): SalaryRecordDTO {
  return {
    id: doc._id.toHexString(),
    yearMonth: doc.yearMonth,
    items: doc.items.map((i) => ({ typeId: i.typeId.toHexString(), amount: i.amount })),
  };
}

function collection() {
  return getDb().then((db) => db.collection<SalaryRecordDoc>("expenses.salaryRecords"));
}

export async function listSalaryRecords(userId: ObjectId): Promise<SalaryRecordDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ yearMonth: 1 }).toArray();
  return docs.map(toDTO);
}

const DUPLICATE_KEY_ERROR = 11000;

/** 一人一月最多一筆薪資紀錄——已經存在就回傳錯誤，請使用者改用編輯。 */
export async function createSalaryRecord(
  userId: ObjectId,
  yearMonth: string,
  items: SalaryRecordItem[],
): Promise<{ record: SalaryRecordDTO; records: SalaryRecordDTO[] } | { error: string }> {
  const col = await collection();
  const doc: SalaryRecordDoc = {
    _id: new ObjectId(),
    userId,
    yearMonth,
    items: items.map((i) => ({ typeId: new ObjectId(i.typeId), amount: i.amount })),
    createdAt: new Date(),
  };
  try {
    await col.insertOne(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === DUPLICATE_KEY_ERROR) {
      return { error: `${yearMonth} 已經有薪資紀錄了，請改用編輯` };
    }
    throw err;
  }
  const records = await listSalaryRecords(userId);
  return { record: toDTO(doc), records };
}

export async function updateSalaryRecord(
  userId: ObjectId,
  id: string,
  items: SalaryRecordItem[],
): Promise<SalaryRecordDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { items: items.map((i) => ({ typeId: new ObjectId(i.typeId), amount: i.amount })) } },
  );
  return listSalaryRecords(userId);
}

export async function deleteSalaryRecord(userId: ObjectId, id: string): Promise<SalaryRecordDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listSalaryRecords(userId);
}
