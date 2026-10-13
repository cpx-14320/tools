import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { AccountDTO, AccountKind } from "./accounts";

interface AccountDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  kind: AccountKind;
  balance: number;
  order: number;
  createdAt: Date;
}

function toDTO(doc: AccountDoc): AccountDTO {
  return { id: doc._id.toHexString(), name: doc.name, icon: doc.icon, kind: doc.kind, balance: doc.balance };
}

function collection() {
  return getDb().then((db) => db.collection<AccountDoc>("expenses.accounts"));
}

export async function listAccounts(userId: ObjectId): Promise<AccountDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ kind: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

export interface AccountInput {
  name: string;
  icon: string;
  kind: AccountKind;
  balance: number;
}

export async function createAccount(userId: ObjectId, input: AccountInput): Promise<{ account: AccountDTO; accounts: AccountDTO[] }> {
  const col = await collection();
  const order = await col.countDocuments({ userId, kind: input.kind });
  const doc: AccountDoc = { _id: new ObjectId(), userId, name: input.name, icon: input.icon, kind: input.kind, balance: input.balance, order, createdAt: new Date() };
  await col.insertOne(doc);
  const accounts = await listAccounts(userId);
  return { account: toDTO(doc), accounts };
}

export async function updateAccount(userId: ObjectId, id: string, input: AccountInput): Promise<AccountDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { name: input.name, icon: input.icon, kind: input.kind, balance: input.balance } },
  );
  return listAccounts(userId);
}

export async function deleteAccount(userId: ObjectId, id: string): Promise<AccountDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listAccounts(userId);
}
