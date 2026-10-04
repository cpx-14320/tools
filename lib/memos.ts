import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

interface MemoDoc {
  _id: ObjectId;
  userId: ObjectId;
  content: string;
  icon: string;
  remindAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoDTO {
  id: string;
  content: string;
  icon: string;
  remindAt: string | null;
}

export interface MemoInput {
  id?: string;
  content: string;
  icon: string;
  remindAt: string | null;
}

function toDTO(doc: MemoDoc): MemoDTO {
  return {
    id: doc._id.toHexString(),
    content: doc.content,
    icon: doc.icon,
    remindAt: doc.remindAt ? doc.remindAt.toISOString() : null,
  };
}

export async function listMemos(userId: ObjectId): Promise<MemoDTO[]> {
  const db = await getDb();
  const docs = await db.collection<MemoDoc>("transit.memos").find({ userId }).sort({ order: 1 }).toArray();
  return docs.map(toDTO);
}

/** 整批同步：前端編輯彈窗把整個清單送上來，這裡跟資料庫現有的那份做 diff——帶 id 的是更新
 *  既有文件，沒帶 id 的是新增，資料庫裡原本有、但這次沒出現在清單裡的就是使用者刪掉的，要砍掉。
 *  所有動作都綁 userId 查詢條件，不會動到別人的備忘錄（即使有人惡意帶了別人的 id 也一樣）。 */
export async function syncMemos(userId: ObjectId, items: MemoInput[]): Promise<MemoDTO[]> {
  const db = await getDb();
  const collection = db.collection<MemoDoc>("transit.memos");

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
    const remindAt = item.remindAt ? new Date(item.remindAt) : null;
    if (item.id && existingIds.has(item.id)) {
      await collection.updateOne(
        { _id: new ObjectId(item.id), userId },
        { $set: { content: item.content, icon: item.icon, remindAt, order: i, updatedAt: now } },
      );
    } else {
      await collection.insertOne({
        _id: new ObjectId(),
        userId,
        content: item.content,
        icon: item.icon,
        remindAt,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return listMemos(userId);
}
