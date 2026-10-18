import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { BudgetRuleDTO, BudgetRuleInput } from "./budgets";

interface BudgetRuleDoc {
  _id: ObjectId;
  userId: ObjectId;
  categoryId: ObjectId;
  effectiveFrom: string; // YYYY-MM
  amount: number;
  createdAt: Date;
}

function toDTO(doc: BudgetRuleDoc): BudgetRuleDTO {
  return {
    id: doc._id.toHexString(),
    categoryId: doc.categoryId.toHexString(),
    effectiveFrom: doc.effectiveFrom,
    amount: doc.amount,
  };
}

function collection() {
  return getDb().then((db) => db.collection<BudgetRuleDoc>("expenses.budgets"));
}

export async function listBudgetRules(userId: ObjectId): Promise<BudgetRuleDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ effectiveFrom: 1 }).toArray();
  return docs.map(toDTO);
}

/** 同一個分類、同一個生效月份只會有一筆——再設一次就是改掉那個月的金額，不是疊第二筆
 *  （upsert）。不然同月兩筆規則誰生效會變成看運氣。 */
export async function upsertBudgetRule(userId: ObjectId, input: BudgetRuleInput): Promise<BudgetRuleDTO[]> {
  const col = await collection();
  const categoryId = new ObjectId(input.categoryId);
  await col.updateOne(
    { userId, categoryId, effectiveFrom: input.effectiveFrom },
    { $set: { amount: input.amount }, $setOnInsert: { _id: new ObjectId(), userId, categoryId, effectiveFrom: input.effectiveFrom, createdAt: new Date() } },
    { upsert: true },
  );
  return listBudgetRules(userId);
}

export async function deleteBudgetRule(userId: ObjectId, id: string): Promise<BudgetRuleDTO[]> {
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return listBudgetRules(userId);
}

/** 分類被刪除時一起把它的預算規則清掉，不留下指向不存在分類的孤兒設定。 */
export async function deleteBudgetRulesForCategories(userId: ObjectId, categoryIds: ObjectId[]): Promise<void> {
  if (categoryIds.length === 0) return;
  const col = await collection();
  await col.deleteMany({ userId, categoryId: { $in: categoryIds } });
}
