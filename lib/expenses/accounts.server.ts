import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { AccountDTO } from "./accounts";

interface AccountDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  accountTypeId: ObjectId;
  openingBalance: number;
  createdAt: Date;
}

function toDTO(doc: AccountDoc): AccountDTO {
  return { id: doc._id.toHexString(), name: doc.name, accountTypeId: doc.accountTypeId.toHexString(), openingBalance: doc.openingBalance };
}

function collection() {
  return getDb().then((db) => db.collection<AccountDoc>("expenses.accounts"));
}

export async function listAccounts(userId: ObjectId): Promise<AccountDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ createdAt: 1 }).toArray();
  return docs.map(toDTO);
}

export interface AccountInput {
  name: string;
  accountTypeId: string;
  openingBalance: number;
}

export async function createAccount(userId: ObjectId, input: AccountInput): Promise<{ account: AccountDTO; accounts: AccountDTO[] }> {
  const col = await collection();
  const doc: AccountDoc = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    accountTypeId: new ObjectId(input.accountTypeId),
    openingBalance: input.openingBalance,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const accounts = await listAccounts(userId);
  return { account: toDTO(doc), accounts };
}

export async function updateAccount(userId: ObjectId, id: string, input: AccountInput): Promise<AccountDTO[]> {
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { name: input.name, accountTypeId: new ObjectId(input.accountTypeId), openingBalance: input.openingBalance } },
  );
  return listAccounts(userId);
}

export async function deleteAccount(userId: ObjectId, id: string): Promise<AccountDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listAccounts(userId);
}
