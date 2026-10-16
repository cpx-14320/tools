import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { accountTypeNameTaken, type AccountKind, type AccountTypeDTO } from "./account-types";

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
): Promise<{ accountType: AccountTypeDTO; accountTypes: AccountTypeDTO[] } | { error: string }> {
  const existing = await listAccountTypes(userId);
  if (accountTypeNameTaken(existing, input.kind, input.name)) return { error: "已經有同樣名稱的類型了，換一個名稱吧。" };

  const col = await collection();
  const order = await col.countDocuments({ userId, kind: input.kind });
  const doc: AccountTypeDoc = { _id: new ObjectId(), userId, name: input.name, icon: input.icon, kind: input.kind, order, createdAt: new Date() };
  await col.insertOne(doc);
  const accountTypes = await listAccountTypes(userId);
  return { accountType: toDTO(doc), accountTypes };
}

/** 類型（資產／負債）建立後不能改——跟分類的 kind 一樣，改了會讓既有帳戶跟類型的
 *  資產/負債認定兜不起來，要改的話請刪除後重新新增。 */
export async function updateAccountType(
  userId: ObjectId,
  id: string,
  input: { name: string; icon: string },
): Promise<{ accountTypes: AccountTypeDTO[] } | { error: string }> {
  const col = await collection();
  const current = await col.findOne({ _id: new ObjectId(id), userId });
  if (current) {
    const existing = await listAccountTypes(userId);
    if (accountTypeNameTaken(existing, current.kind, input.name, id)) return { error: "已經有同樣名稱的類型了，換一個名稱吧。" };
  }
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: { name: input.name, icon: input.icon } });
  return { accountTypes: await listAccountTypes(userId) };
}

/** 刪除前查一下還有幾個帳戶掛著這個類型——類型決定資產/負債跟圖示，刪除後若還有帳戶
 *  在用，那些帳戶的資產/負債判定會悄悄跑掉（查不到類型時 accountKind() 一律當成
 *  「資產」，見 accounts.ts），所以這裡直接擋下，不像分類還有「未分類」可以歸類
 *  ——帳戶類型沒有一個通用的歸宿可以自動改掛，要刪除請先把這些帳戶改成別的類型。 */
export async function countAccountTypeUsage(userId: ObjectId, id: string): Promise<number> {
  const db = await getDb();
  return db.collection("expenses.accounts").countDocuments({ userId, accountTypeId: new ObjectId(id) });
}

export async function deleteAccountType(
  userId: ObjectId,
  id: string,
): Promise<{ accountTypes: AccountTypeDTO[] } | { error: string; inUseCount: number }> {
  const inUseCount = await countAccountTypeUsage(userId, id);
  if (inUseCount > 0) return { error: "帳戶類型仍有帳戶使用中", inUseCount };

  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return { accountTypes: await listAccountTypes(userId) };
}
