import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

interface WeekendTripDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  caption: string;
  image: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeekendTripDTO {
  id: string;
  title: string;
  caption: string;
  image: string;
}

export interface WeekendTripInput {
  id?: string;
  title: string;
  caption: string;
  image: string;
}

function toDTO(doc: WeekendTripDoc): WeekendTripDTO {
  return { id: doc._id.toHexString(), title: doc.title, caption: doc.caption, image: doc.image };
}

export async function listWeekendTrips(userId: ObjectId): Promise<WeekendTripDTO[]> {
  const db = await getDb();
  const docs = await db.collection<WeekendTripDoc>("transit.weekendTrips").find({ userId }).sort({ order: 1 }).toArray();
  return docs.map(toDTO);
}

/** 整批同步，跟 lib/memos.ts 的 syncMemos 同一套做法：前端編輯彈窗把整份清單送上來，
 *  這裡跟資料庫現有的那份做 diff，帶 id 的更新、沒帶 id 的新增、資料庫裡有但這次沒出現
 *  在清單裡的刪掉。 */
export async function syncWeekendTrips(userId: ObjectId, items: WeekendTripInput[]): Promise<WeekendTripDTO[]> {
  const db = await getDb();
  const collection = db.collection<WeekendTripDoc>("transit.weekendTrips");

  const existing = await collection.find({ userId }).toArray();
  const existingIds = new Set(existing.map((d) => d._id.toHexString()));
  const keepIds = new Set(items.filter((item) => item.id).map((item) => item.id as string));

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    await collection.deleteMany({ userId, _id: { $in: toDelete.map((id) => new ObjectId(id)) } });
  }

  const now = new Date();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.id && existingIds.has(item.id)) {
      await collection.updateOne(
        { _id: new ObjectId(item.id), userId },
        { $set: { title: item.title, caption: item.caption, image: item.image, order: i, updatedAt: now } },
      );
    } else {
      await collection.insertOne({
        _id: new ObjectId(),
        userId,
        title: item.title,
        caption: item.caption,
        image: item.image,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return listWeekendTrips(userId);
}
