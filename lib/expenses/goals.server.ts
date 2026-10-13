import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { SavingsGoalDTO } from "./goals";

interface SavingsGoalDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  startDate?: string; // YYYY-MM-DD，純顯示用
  targetDate?: string; // YYYY-MM-DD，沒填代表沒有期限
  createdAt: Date;
}

function toDTO(doc: SavingsGoalDoc): SavingsGoalDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    icon: doc.icon,
    targetAmount: doc.targetAmount,
    currentAmount: doc.currentAmount,
    startDate: doc.startDate,
    targetDate: doc.targetDate,
  };
}

function collection() {
  return getDb().then((db) => db.collection<SavingsGoalDoc>("expenses.goals"));
}

export async function listGoals(userId: ObjectId): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ createdAt: 1 }).toArray();
  return docs.map(toDTO);
}

export interface CreateGoalInput {
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  startDate?: string;
  targetDate?: string;
}

export async function createGoal(
  userId: ObjectId,
  input: CreateGoalInput,
): Promise<{ goal: SavingsGoalDTO; goals: SavingsGoalDTO[] }> {
  const col = await collection();
  const doc: SavingsGoalDoc = { _id: new ObjectId(), userId, ...input, createdAt: new Date() };
  await col.insertOne(doc);
  const goals = await listGoals(userId);
  return { goal: toDTO(doc), goals };
}

export interface UpdateGoalInput {
  name: string;
  icon: string;
  targetAmount: number;
  startDate?: string;
  targetDate?: string;
}

export async function updateGoal(userId: ObjectId, id: string, input: UpdateGoalInput): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $set: input });
  return listGoals(userId);
}

/** 存入：把金額加到目前已存金額——不另外留一份存入紀錄，只更新累計總額。 */
export async function contributeToGoal(userId: ObjectId, id: string, amount: number): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId }, { $inc: { currentAmount: amount } });
  return listGoals(userId);
}

export async function deleteGoal(userId: ObjectId, id: string): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listGoals(userId);
}
