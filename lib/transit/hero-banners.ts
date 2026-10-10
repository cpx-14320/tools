import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";

interface HeroBannerDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  caption: string;
  image: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface HeroBannerDTO {
  id: string;
  title: string;
  caption: string;
  image: string;
}

export interface HeroBannerInput {
  id?: string;
  title: string;
  caption: string;
  image: string;
}

function toDTO(doc: HeroBannerDoc): HeroBannerDTO {
  return { id: doc._id.toHexString(), title: doc.title, caption: doc.caption, image: doc.image };
}

export async function listHeroBanners(userId: ObjectId): Promise<HeroBannerDTO[]> {
  const db = await getDb();
  const docs = await db.collection<HeroBannerDoc>("transit.heroBanners").find({ userId }).sort({ order: 1 }).toArray();
  return docs.map(toDTO);
}

/** 跟 lib/weekend-trips.ts 的 syncWeekendTrips 同一套整批同步做法。 */
export async function syncHeroBanners(userId: ObjectId, items: HeroBannerInput[]): Promise<HeroBannerDTO[]> {
  const db = await getDb();
  const collection = db.collection<HeroBannerDoc>("transit.heroBanners");

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

  return listHeroBanners(userId);
}
