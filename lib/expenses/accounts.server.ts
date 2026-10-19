import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { accountNameTaken, type AccountDTO } from "./accounts";

interface AccountDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  accountTypeId: ObjectId;
  openingBalance: number;
  createdAt: Date;
  /** 系統預設建立的帳戶（見 presets.server.ts）——「清除全部資料」會略過。 */
  isPreset?: boolean;
}

function toDTO(doc: AccountDoc): AccountDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    accountTypeId: doc.accountTypeId.toHexString(),
    openingBalance: doc.openingBalance,
    isPreset: doc.isPreset,
  };
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

export async function createAccount(
  userId: ObjectId,
  input: AccountInput,
): Promise<{ account: AccountDTO; accounts: AccountDTO[] } | { error: string }> {
  const existing = await listAccounts(userId);
  if (accountNameTaken(existing, input.name)) return { error: "已經有同樣名稱的帳戶了，換一個名稱吧。" };

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

export async function updateAccount(
  userId: ObjectId,
  id: string,
  input: AccountInput,
): Promise<{ accounts: AccountDTO[] } | { error: string }> {
  const existing = await listAccounts(userId);
  if (accountNameTaken(existing, input.name, id)) return { error: "已經有同樣名稱的帳戶了，換一個名稱吧。" };

  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { name: input.name, accountTypeId: new ObjectId(input.accountTypeId), openingBalance: input.openingBalance } },
  );
  return { accounts: await listAccounts(userId) };
}

/** 刪除前查一下這個帳戶還有幾筆交易／轉帳掛著——不是為了擋下刪除（帳戶被刪除後交易
 *  變成「不指定帳戶」本來就是支援的狀態，不是壞資料），是讓呼叫端可以先跟使用者說
 *  清楚「這個帳戶還有 N 筆紀錄」，使用者自己決定要不要繼續，不是刪了才發現。 */
export async function countAccountUsage(userId: ObjectId, id: string): Promise<number> {
  const db = await getDb();
  const accountObjId = new ObjectId(id);
  const [txCount, transferCount] = await Promise.all([
    db.collection("expenses.transactions").countDocuments({ userId, accountId: accountObjId }),
    db.collection("expenses.transfers").countDocuments({ userId, $or: [{ fromAccountId: accountObjId }, { toAccountId: accountObjId }] }),
  ]);
  return txCount + transferCount;
}

export async function deleteAccount(userId: ObjectId, id: string): Promise<AccountDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listAccounts(userId);
}
