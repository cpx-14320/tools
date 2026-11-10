import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { accountNameTaken, type AccountDTO, type AccountUsage } from "./accounts";
import { putInTrash } from "./trash.server";

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
/** 有哪些東西掛在這個帳戶上。
 *
 *  **分開回報而不是給一個總數**：每一種的後果不一樣——交易會變成「不指定帳戶」、轉帳
 *  會留著但一端顯示「已刪除帳戶」、轉帳型的固定收支會被暫停。只給一個數字的話，刪除
 *  前的確認就只能講一句籠統的「還有 N 筆紀錄」，使用者判斷不了該不該刪。
 *
 *  本來只算交易跟轉帳，漏掉了分類的預設帳戶、存錢目標的綁定、轉帳型固定收支——所以
 *  一個「只被一條轉帳規則用到」的帳戶，刪除時算出來是 0 筆，完全不會跳警告。 */
export async function accountUsage(userId: ObjectId, id: string): Promise<AccountUsage> {
  const db = await getDb();
  const accountObjId = new ObjectId(id);
  const [transactions, transfers, categories, goals, transferRules] = await Promise.all([
    db.collection("expenses.transactions").countDocuments({ userId, accountId: accountObjId }),
    db.collection("expenses.transfers").countDocuments({ userId, $or: [{ fromAccountId: accountObjId }, { toAccountId: accountObjId }] }),
    db.collection("expenses.categories").countDocuments({ userId, defaultAccountId: accountObjId }),
    db.collection("expenses.goals").countDocuments({ userId, accountId: accountObjId }),
    db.collection("expenses.recurringRules").countDocuments({
      userId,
      $or: [{ "transfer.fromAccountId": accountObjId }, { "transfer.toAccountId": accountObjId }],
    }),
  ]);
  return { transactions, transfers, categories, goals, transferRules, total: transactions + transfers + categories + goals + transferRules };
}

export async function countAccountUsage(userId: ObjectId, id: string): Promise<number> {
  return (await accountUsage(userId, id)).total;
}

export async function deleteAccount(userId: ObjectId, id: string): Promise<{ accounts: AccountDTO[]; trashId?: string }> {
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  if (!doc) return { accounts: await listAccounts(userId) };

  const trashId = await putInTrash(userId, {
    kind: "account",
    label: doc.name,
    entries: [{ collection: "expenses.accounts", doc }],
  });
  await col.deleteOne({ _id: doc._id, userId });

  // 轉帳型的固定收支指到這個帳戶的話要停掉。
  //
  // **為什麼只有這一種需要動手**：其他參照（交易、轉帳、分類的預設帳戶、存錢目標的
  // 綁定）都只是「顯示不出帳戶」，帳戶從垃圾桶救回來就自動接回去，動它反而接不回來。
  // 轉帳規則不一樣——它會**繼續產生新的壞資料**：每一期都生出一筆轉到不存在帳戶的
  // 轉帳，而那些錢不會進任何帳戶的餘額，等於默默蒸發，而且使用者完全沒有徵兆。
  //
  // 停掉而不是刪掉：使用者把帳戶還原回來之後，自己按一下恢復就好（卡片上看得到
  // 「已暫停」）。自動恢復要另外記一筆狀態，而且他可能根本就是想停掉這條規則。
  const db = await getDb();
  await db.collection("expenses.recurringRules").updateMany(
    { userId, $or: [{ "transfer.fromAccountId": doc._id }, { "transfer.toAccountId": doc._id }] },
    { $set: { active: false } },
  );

  return { accounts: await listAccounts(userId), trashId };
}
