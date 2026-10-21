import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { budgetForMonth, withLegacyCategoryBudgets } from "./budgets";
import { listBudgetRules } from "./budgets.server";
import { listCategories } from "./categories.server";
import { topLevelCategoryId } from "./categories";
import { DEFAULT_OUTFIT_ID, pendingRewards, petItemById, type PetReward } from "./pet";

interface PetDoc {
  _id: ObjectId;
  userId: ObjectId;
  coins: number;
  xp: number;
  /** 目前穿在身上的服裝 id。 */
  outfitId: string;
  /** 已經買過的服裝（食物是消耗品，買了直接吃掉，不進這裡）。 */
  ownedOutfitIds: string[];
  /** 已經發過的獎勵 key——結算每次進記帳本都會跑，靠這個確保同一筆獎勵只發一次。 */
  claimedKeys: string[];
  createdAt: Date;
}

export interface PetStateDTO {
  coins: number;
  xp: number;
  outfitId: string;
  ownedOutfitIds: string[];
  /** 這一次結算剛發出去的獎勵，給畫面上跳提示用。 */
  justEarned: PetReward[];
}

function collection() {
  return getDb().then((db) => db.collection<PetDoc>("expenses.pet"));
}

function toDTO(doc: PetDoc, justEarned: PetReward[] = []): PetStateDTO {
  return { coins: doc.coins, xp: doc.xp, outfitId: doc.outfitId, ownedOutfitIds: doc.ownedOutfitIds, justEarned };
}

/** 讀取（沒有就建一個初始狀態）。第一次進養成頁的人直接有一套預設服裝、0 幣 0 經驗。 */
async function ensurePet(userId: ObjectId): Promise<PetDoc> {
  const col = await collection();
  const existing = await col.findOne({ userId });
  if (existing) return existing;
  const doc: PetDoc = {
    _id: new ObjectId(),
    userId,
    coins: 0,
    xp: 0,
    outfitId: DEFAULT_OUTFIT_ID,
    ownedOutfitIds: [DEFAULT_OUTFIT_ID],
    claimedKeys: [],
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  return doc;
}

/** 上個月是不是「每個有編預算的分類都沒超支」——是的話回傳那個月份，否則回傳 null。
 *
 *  沒有編任何預算的話也回傳 null：沒設目標就稱不上守住目標，發獎金說不過去。 */
async function budgetKeptMonth(userId: ObjectId, today: string): Promise<string | null> {
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const prev = new Date(year, month - 2, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const [categories, rules] = await Promise.all([listCategories(userId), listBudgetRules(userId)]);
  const effectiveRules = withLegacyCategoryBudgets(rules, categories);
  const budgeted = categories.filter((c) => !c.parentId && c.kind === "支出" && (budgetForMonth(effectiveRules, c.id, prevMonth) ?? 0) > 0);
  if (budgeted.length === 0) return null;

  const db = await getDb();
  const txs = await db
    .collection<{ categoryId: ObjectId; amount: number; date: string }>("expenses.transactions")
    .find({ userId, date: { $gte: `${prevMonth}-01`, $lte: `${prevMonth}-31` } })
    .toArray();

  const spentByTop = new Map<string, number>();
  for (const t of txs) {
    const topId = topLevelCategoryId(categories, t.categoryId.toHexString());
    spentByTop.set(topId, (spentByTop.get(topId) ?? 0) + t.amount);
  }

  const allKept = budgeted.every((c) => (spentByTop.get(c.id) ?? 0) <= (budgetForMonth(effectiveRules, c.id, prevMonth) ?? 0));
  return allKept ? prevMonth : null;
}

/** 結算獎勵：算出還沒發過的獎勵，一次把幣加上去、把 key 記起來。
 *
 *  掛在每次進記帳本時跑（跟固定收支自動入帳同一個時機），所以必須是冪等的——重複跑
 *  只會發一次，靠的是 claimedKeys。 */
export async function settlePetRewards(userId: ObjectId, today: string): Promise<PetStateDTO> {
  const pet = await ensurePet(userId);

  const db = await getDb();
  const dates = await db.collection("expenses.transactions").distinct("date", { userId });
  const rewards = pendingRewards({
    datesWithEntries: new Set(dates as string[]),
    today,
    budgetKeptMonth: await budgetKeptMonth(userId, today),
    claimedKeys: new Set(pet.claimedKeys),
  });
  if (rewards.length === 0) return toDTO(pet);

  const coins = rewards.reduce((sum, r) => sum + r.coins, 0);
  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $inc: { coins }, $push: { claimedKeys: { $each: rewards.map((r) => r.key) } } });
  return toDTO({ ...pet, coins: pet.coins + coins }, rewards);
}

export async function getPetState(userId: ObjectId): Promise<PetStateDTO> {
  return toDTO(await ensurePet(userId));
}

/** 買食物並立刻餵——食物是消耗品，不進背包，直接換成經驗值。 */
export async function feedPet(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || item.kind !== "食物" || !item.xp) return { error: "找不到這個食物" };

  const pet = await ensurePet(userId);
  if (pet.coins < item.price) return { error: "星星幣不夠" };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $inc: { coins: -item.price, xp: item.xp } });
  return toDTO({ ...pet, coins: pet.coins - item.price, xp: pet.xp + item.xp });
}

/** 買服裝（已經有的不能重複買），買完直接穿上。 */
export async function buyOutfit(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || item.kind !== "服裝") return { error: "找不到這件服裝" };

  const pet = await ensurePet(userId);
  if (pet.ownedOutfitIds.includes(itemId)) return { error: "這件已經有了" };
  if (pet.coins < item.price) return { error: "星星幣不夠" };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $inc: { coins: -item.price }, $push: { ownedOutfitIds: itemId }, $set: { outfitId: itemId } });
  return toDTO({ ...pet, coins: pet.coins - item.price, ownedOutfitIds: [...pet.ownedOutfitIds, itemId], outfitId: itemId });
}

/** 換穿已經擁有的服裝。 */
export async function equipOutfit(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const pet = await ensurePet(userId);
  if (!pet.ownedOutfitIds.includes(itemId)) return { error: "還沒有這件服裝" };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $set: { outfitId: itemId } });
  return toDTO({ ...pet, outfitId: itemId });
}
