import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { CategoryColor, CategoryDTO, CategoryKind } from "./categories";

interface CategoryDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
  /** 頂層分類存 null（不是 undefined／省略欄位）——MongoDB 驅動預設會把 undefined 欄位序列化
   *  成 BSON null，所以乾脆讓型別跟實際存進去的值一致，查詢時也統一用 parentId: null 比對
   *  「沒有父分類」，不要用 $exists:false（那個比對不到值是 null 但欄位確實存在的文件）。 */
  parentId: ObjectId | null;
  order: number;
  createdAt: Date;
}

function toDTO(doc: CategoryDoc): CategoryDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    kind: doc.kind,
    parentId: doc.parentId?.toHexString(),
  };
}

function collection() {
  return getDb().then((db) => db.collection<CategoryDoc>("expenses.categories"));
}

export async function listCategories(userId: ObjectId): Promise<CategoryDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ kind: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

export interface CreateCategoryInput {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
  parentId?: string;
}

export async function createCategory(
  userId: ObjectId,
  input: CreateCategoryInput,
): Promise<{ category: CategoryDTO; categories: CategoryDTO[] } | { error: string }> {
  const col = await collection();

  let parentId: ObjectId | null = null;
  let kind = input.kind;
  if (input.parentId) {
    const parent = await col.findOne({ _id: new ObjectId(input.parentId), userId, parentId: null });
    if (!parent) return { error: "找不到要新增子分類的父分類" };
    parentId = parent._id;
    kind = parent.kind; // 子分類的 kind 跟父分類一致，不能自己另外選
  }

  const order = await col.countDocuments({ userId, parentId, kind });
  const doc: CategoryDoc = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    icon: input.icon,
    color: input.color,
    kind,
    parentId,
    order,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const categories = await listCategories(userId);
  return { category: toDTO(doc), categories };
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  color?: CategoryColor;
}

export async function updateCategory(userId: ObjectId, id: string, input: UpdateCategoryInput): Promise<CategoryDTO[]> {
  const col = await collection();
  // 子分類編輯時不會送 color（顏色跟父分類一致、不能自己改），這裡要過濾掉 undefined 欄位，
  // 不然 $set 可能把欄位整個設成 null，蓋掉原本繼承來的顏色。
  const fields = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(fields).length > 0) {
    await col.updateOne({ _id: new ObjectId(id), userId }, { $set: fields });
  }
  return listCategories(userId);
}

/** 刪除大分類會連同底下的子分類一起刪掉；既有消費紀錄若引用到被刪除的分類不會跟著刪，
 *  只是之後查詢時 categoryPath／categoryById 會顯示「（已刪除分類）」。 */
export async function deleteCategory(userId: ObjectId, id: string): Promise<CategoryDTO[]> {
  const col = await collection();
  const target = new ObjectId(id);
  await col.deleteMany({ userId, $or: [{ _id: target }, { parentId: target }] });
  return listCategories(userId);
}
