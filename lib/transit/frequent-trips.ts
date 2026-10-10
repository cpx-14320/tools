import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";

interface FrequentTripDoc {
  _id: ObjectId;
  userId: ObjectId;
  mode: string;
  // 使用者自訂分類（見 lib/trip-groups.ts）的 id，取代原本寫死的「啟程／返程」兩種。
  groupId: string;
  icon: string;
  // 公車是「路線優先」（見 components/transit/bus-route-picker-modal.tsx），不是起訖站：
  // originCity 存縣市、origin 存路線名稱、dest 存站牌名稱、destCity 不使用；busDirection
  // （0＝去程、1＝返程）只有公車會用到，其他車種維持 undefined。
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  busDirection?: 0 | 1;
  startTime: string;
  endTime: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FrequentTripDTO {
  id: string;
  mode: string;
  groupId: string;
  icon: string;
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  busDirection?: 0 | 1;
  startTime: string;
  endTime: string;
}

export interface FrequentTripInput {
  id?: string;
  icon: string;
  originCity: string;
  origin: string;
  destCity: string;
  dest: string;
  busDirection?: 0 | 1;
  startTime: string;
  endTime: string;
}

function toDTO(doc: FrequentTripDoc): FrequentTripDTO {
  return {
    id: doc._id.toHexString(),
    mode: doc.mode,
    groupId: doc.groupId,
    icon: doc.icon,
    originCity: doc.originCity,
    origin: doc.origin,
    destCity: doc.destCity,
    dest: doc.dest,
    busDirection: doc.busDirection,
    startTime: doc.startTime,
    endTime: doc.endTime,
  };
}

export async function listFrequentTrips(userId: ObjectId): Promise<FrequentTripDTO[]> {
  const db = await getDb();
  const docs = await db
    .collection<FrequentTripDoc>("transit.frequentTrips")
    .find({ userId })
    .sort({ mode: 1, groupId: 1, order: 1 })
    .toArray();
  return docs.map(toDTO);
}

/** 編輯彈窗一次編輯「單一分類」整份清單（跟 lib/memos.ts 的整批 diff 同步同一套做法），
 *  查詢/刪除都用 userId + mode + groupId 範圍，不會動到其他分類的資料。 */
export async function syncFrequentTrips(userId: ObjectId, mode: string, groupId: string, items: FrequentTripInput[]): Promise<FrequentTripDTO[]> {
  const db = await getDb();
  const collection = db.collection<FrequentTripDoc>("transit.frequentTrips");

  const existing = await collection.find({ userId, mode, groupId }).toArray();
  const existingIds = new Set(existing.map((d) => d._id.toHexString()));
  const keepIds = new Set(items.filter((item) => item.id).map((item) => item.id as string));

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    await collection.deleteMany({ userId, mode, groupId, _id: { $in: toDelete.map((id) => new ObjectId(id)) } });
  }

  const now = new Date();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.id && existingIds.has(item.id)) {
      await collection.updateOne(
        { _id: new ObjectId(item.id), userId, mode, groupId },
        {
          $set: {
            icon: item.icon,
            originCity: item.originCity,
            origin: item.origin,
            destCity: item.destCity,
            dest: item.dest,
            busDirection: item.busDirection,
            startTime: item.startTime,
            endTime: item.endTime,
            order: i,
            updatedAt: now,
          },
        },
      );
    } else {
      await collection.insertOne({
        _id: new ObjectId(),
        userId,
        mode,
        groupId,
        icon: item.icon,
        originCity: item.originCity,
        origin: item.origin,
        destCity: item.destCity,
        dest: item.dest,
        busDirection: item.busDirection,
        startTime: item.startTime,
        endTime: item.endTime,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return listFrequentTrips(userId);
}
