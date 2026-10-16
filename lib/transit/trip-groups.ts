import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";

interface TripGroupDoc {
  _id: ObjectId;
  userId: ObjectId;
  mode: string;
  name: string;
  order: number;
  createdAt: Date;
}

export interface TripGroupDTO {
  id: string;
  mode: string;
  name: string;
}

function toDTO(doc: TripGroupDoc): TripGroupDTO {
  return { id: doc._id.toHexString(), mode: doc.mode, name: doc.name };
}

export async function listTripGroups(userId: ObjectId): Promise<TripGroupDTO[]> {
  const db = await getDb();
  const docs = await db.collection<TripGroupDoc>("transit.tripGroups").find({ userId }).sort({ mode: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

// 分類名稱（例如「啟程」「返程」「假日出去玩」）完全由使用者自訂、自由新增，不是寫死的
// 兩種——每個分類是獨立一份文件，使用者可以依車種各自新增任意多個。
export async function createTripGroup(userId: ObjectId, mode: string, name: string): Promise<{ group: TripGroupDTO; groups: TripGroupDTO[] }> {
  const db = await getDb();
  const collection = db.collection<TripGroupDoc>("transit.tripGroups");
  const order = await collection.countDocuments({ userId, mode });
  const doc: TripGroupDoc = { _id: new ObjectId(), userId, mode, name, order, createdAt: new Date() };
  await collection.insertOne(doc);
  const groups = await listTripGroups(userId);
  return { group: toDTO(doc), groups };
}

export async function renameTripGroup(userId: ObjectId, id: string, name: string): Promise<TripGroupDTO[]> {
  const db = await getDb();
  await db.collection("transit.tripGroups").updateOne({ _id: new ObjectId(id), userId }, { $set: { name } });
  return listTripGroups(userId);
}

/**
 * 重新排序某個車種底下的分類。前端把拖曳完的完整 id 順序送上來，這裡照陣列索引寫回
 * order 欄位（listTripGroups 本來就是用 order 排序）。
 *
 * 以前只有 createTripGroup 在設 order（＝建立當下已有幾個分類），所以順序永遠是建立
 * 順序，使用者想把「上班」固定在最上面只能砍掉重建。
 *
 * 不信任前端傳來的 id 清單：先用 userId＋mode 查出真的屬於這個使用者、這個車種的分類
 * （別人的 id 混進來也不會被動到），再照傳進來的順序排；清單裡沒出現的分類（例如前端
 * 的資料比較舊、少了剛在別的裝置新增的那一筆）接在後面，不會不見。
 */
export async function reorderTripGroups(userId: ObjectId, mode: string, orderedIds: string[]): Promise<TripGroupDTO[]> {
  const db = await getDb();
  const collection = db.collection<TripGroupDoc>("transit.tripGroups");
  const existing = await collection.find({ userId, mode }).sort({ order: 1 }).toArray();
  const existingIds = existing.map((d) => d._id.toHexString());

  const requested = orderedIds.filter((id) => existingIds.includes(id));
  const finalOrder = [...requested, ...existingIds.filter((id) => !requested.includes(id))];

  await Promise.all(
    finalOrder.map((id, index) => collection.updateOne({ _id: new ObjectId(id), userId, mode }, { $set: { order: index } })),
  );

  return listTripGroups(userId);
}

// 刪除分類時，底下掛的常用行程清單要一起清掉，不留沒有分類可以歸屬的孤兒資料；
// 回傳值特意同時給 groups 跟剩下的 frequentTrips 清單，前端兩份 state 一次更新完。
export async function deleteTripGroup(userId: ObjectId, id: string): Promise<{ groups: TripGroupDTO[] }> {
  const db = await getDb();
  await db.collection("transit.tripGroups").deleteOne({ _id: new ObjectId(id), userId });
  await db.collection("transit.frequentTrips").deleteMany({ userId, groupId: id });
  const groups = await listTripGroups(userId);
  return { groups };
}
