import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type { UserDoc } from "./auth";

export interface AdminUserDTO {
  id: string;
  username: string;
  name: string;
  tools: string[];
  isAdmin: boolean;
}

function toAdminUserDTO(doc: UserDoc): AdminUserDTO {
  return { id: doc._id.toHexString(), username: doc.username, name: doc.name, tools: doc.tools, isAdmin: !!doc.isAdmin };
}

export async function listUsersForAdmin(): Promise<AdminUserDTO[]> {
  const db = await getDb();
  const docs = await db.collection<UserDoc>("users").find().sort({ username: 1 }).toArray();
  return docs.map(toAdminUserDTO);
}

export async function updateUserTools(userId: ObjectId, tools: string[]): Promise<void> {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne({ _id: userId }, { $set: { tools } });
}

/** 刪帳號要連同這個使用者在每個工具底下留下的資料一起清掉，不然 users 文件沒了但
 *  transit.* ／ expenses.* 系列 collection 裡一堆 userId 指到不存在的使用者，變成孤兒
 *  資料（Mongo 沒有外鍵，不會自動幫忙連動刪除）。之後新工具如果也存使用者資料、
 *  要記得把它的 collection 加進這個清單——管理後台的刪除確認寫的是「在各工具底下存的
 *  資料也會一併刪除」，漏掉一個 collection 就是那句話沒做到。
 *
 *  每一個 collection 都是以 userId 分格的（見各工具的 *.server.ts），所以一律用同一個
 *  條件刪；只有 users 自己是用 _id。transit.tdxCache 不在清單裡：那是共用的路線／站牌
 *  快取，不屬於任何使用者。 */
const USER_DATA_COLLECTIONS = [
  "sessions",
  "transit.frequentTrips",
  "transit.tripGroups",
  "transit.weekendTrips",
  "transit.heroBanners",
  "transit.memos",
  "expenses.accounts",
  "expenses.accountTypes",
  "expenses.aiDrafts",
  "expenses.budgets",
  "expenses.categories",
  "expenses.goals",
  "expenses.meta",
  "expenses.pet",
  "expenses.recurringRules",
  "expenses.settings",
  "expenses.transactions",
  "expenses.transfers",
  "expenses.trash",
];

export async function deleteUserCascade(userId: ObjectId): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection("users").deleteOne({ _id: userId }),
    ...USER_DATA_COLLECTIONS.map((name) => db.collection(name).deleteMany({ userId })),
  ]);
}
