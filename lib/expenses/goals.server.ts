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

/** 刪除目標前，先解除所有連著它的固定收支規則（linkedGoalId 設回空）——不然規則還留著
 *  一個指向已刪除目標的 id，之後每次自動入帳都會對一個不存在的目標做 $inc，靜默什麼事
 *  都不會發生，使用者永遠不會發現連動早就失效了（見 recurring-rules.server.ts 的
 *  confirmOneOccurrence）。規則本身不用跟著刪，只是不再連動存錢目標。 */
export async function deleteGoal(userId: ObjectId, id: string): Promise<SavingsGoalDTO[]> {
  const db = await getDb();
  const goalId = new ObjectId(id);
  await db.collection("expenses.recurringRules").updateMany({ userId, linkedGoalId: goalId }, { $unset: { linkedGoalId: "" } });

  const col = await collection();
  await col.deleteOne({ _id: goalId, userId });
  return listGoals(userId);
}
