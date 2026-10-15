import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { TransferDTO, TransferInput } from "./transfers";

interface TransferDoc {
  _id: ObjectId;
  userId: ObjectId;
  fromAccountId: ObjectId;
  toAccountId: ObjectId;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
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
  };
}

function collection() {
  return getDb().then((db) => db.collection<TransferDoc>("expenses.transfers"));
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
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const transfers = await listTransfers(userId);
  return { transfer: toDTO(doc), transfers };
}

export async function updateTransfer(userId: ObjectId, id: string, input: TransferInput): Promise<TransferDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    {
      $set: {
        fromAccountId: new ObjectId(input.fromAccountId),
        toAccountId: new ObjectId(input.toAccountId),
        amount: input.amount,
        date: input.date,
        note: input.note,
      },
    },
  );
  return listTransfers(userId);
}

export async function deleteTransfer(userId: ObjectId, id: string): Promise<TransferDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listTransfers(userId);
}
