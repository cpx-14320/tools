import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { AccountKind, AccountTypeDTO } from "./account-types";

interface AccountTypeDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  kind: AccountKind;
  order: number;
  createdAt: Date;
}

function toDTO(doc: AccountTypeDoc): AccountTypeDTO {
  return { id: doc._id.toHexString(), name: doc.name, icon: doc.icon, kind: doc.kind };
}

function collection() {
  return getDb().then((db) => db.collection<AccountTypeDoc>("expenses.accountTypes"));
}

export async function listAccountTypes(userId: ObjectId): Promise<AccountTypeDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ kind: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

export interface AccountTypeInput {
  name: string;
  icon: string;
  kind: AccountKind;
}

export async function createAccountType(
  userId: ObjectId,
  input: AccountTypeInput,
): Promise<{ accountType: AccountTypeDTO; accountTypes: AccountTypeDTO[] }> {
  const col = await collection();
  const order = await col.countDocuments({ userId, kind: input.kind });
  const doc: AccountTypeDoc = { _id: new ObjectId(), userId, name: input.name, icon: input.icon, kind: input.kind, order, createdAt: new Date() };
  await col.insertOne(doc);
  const accountTypes = await listAccountTypes(userId);
  return { accountType: toDTO(doc), accountTypes };
}

/** 類型（資產／負債）建立後不能改——跟分類的 kind 一樣，改了會讓既有帳戶跟類型的
 *  資產/負債認定兜不起來，要改的話請刪除後重新新增。 */
export async function updateAccountType(userId: ObjectId, id: string, input: { name: string; icon: string }): Promise<AccountTypeDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: { name: input.name, icon: input.icon } });
  return listAccountTypes(userId);
}

/** 刪除類型不會動到既有帳戶，只是那些帳戶的 accountTypeId 會變成指向已刪除的類型——
 *  跟分類被刪除時的行為一致，顯示層用 accountTypeById 查不到時自己處理 fallback。 */
export async function deleteAccountType(userId: ObjectId, id: string): Promise<AccountTypeDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listAccountTypes(userId);
}
