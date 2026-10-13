import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { SalaryItemKind, SalaryItemTypeDTO } from "./salary-types";

interface SalaryItemTypeDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  kind: SalaryItemKind;
  order: number;
  createdAt: Date;
}

function toDTO(doc: SalaryItemTypeDoc): SalaryItemTypeDTO {
  return { id: doc._id.toHexString(), name: doc.name, kind: doc.kind };
}

function collection() {
  return getDb().then((db) => db.collection<SalaryItemTypeDoc>("expenses.salaryItemTypes"));
}

export async function listSalaryItemTypes(userId: ObjectId): Promise<SalaryItemTypeDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ kind: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

export async function createSalaryItemType(
  userId: ObjectId,
  name: string,
  kind: SalaryItemKind,
): Promise<{ type: SalaryItemTypeDTO; types: SalaryItemTypeDTO[] }> {
  const col = await collection();
  const order = await col.countDocuments({ userId, kind });
  const doc: SalaryItemTypeDoc = { _id: new ObjectId(), userId, name, kind, order, createdAt: new Date() };
  await col.insertOne(doc);
  const types = await listSalaryItemTypes(userId);
  return { type: toDTO(doc), types };
}

export async function updateSalaryItemType(
  userId: ObjectId,
  id: string,
  name: string,
  kind: SalaryItemKind,
): Promise<SalaryItemTypeDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: { name, kind } });
  return listSalaryItemTypes(userId);
}

export async function deleteSalaryItemType(userId: ObjectId, id: string): Promise<SalaryItemTypeDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listSalaryItemTypes(userId);
}
