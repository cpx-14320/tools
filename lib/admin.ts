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
 *  transit.* 系列 collection 裡一堆 userId 指到不存在的使用者，變成孤兒資料
 *  （Mongo 沒有外鍵，不會自動幫忙連動刪除）。之後新工具如果也存使用者資料、
 *  要記得把它的 collection 加進這個清單。 */
export async function deleteUserCascade(userId: ObjectId): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection("users").deleteOne({ _id: userId }),
    db.collection("sessions").deleteMany({ userId }),
    db.collection("transit.frequentTrips").deleteMany({ userId }),
    db.collection("transit.tripGroups").deleteMany({ userId }),
    db.collection("transit.weekendTrips").deleteMany({ userId }),
    db.collection("transit.heroBanners").deleteMany({ userId }),
    db.collection("transit.memos").deleteMany({ userId }),
  ]);
}
