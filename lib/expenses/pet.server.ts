import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { budgetForMonth, withLegacyCategoryBudgets } from "./budgets";
import { listBudgetRules } from "./budgets.server";
import { listCategories } from "./categories.server";
import { topLevelCategoryId } from "./categories";
import { DEFAULT_BACKGROUND_ID, DEFAULT_OUTFIT_ID, PET_ITEMS, pendingRewards, petItemById, type PetReward } from "./pet";

interface PetDoc {
  _id: ObjectId;
  userId: ObjectId;
  coins: number;
  xp: number;
  /** 目前穿在身上的服裝 id。 */
  outfitId: string;
  /** 已經買過的服裝（一次性購買，可以重複換穿，不會用掉）。 */
  ownedOutfitIds: string[];
  /** 目前的場地背景 id／已經買過的背景。規則跟服裝一樣，欄位分開存。
   *  舊文件沒有這兩個欄位（背景商品加進來之前建的），讀出來時用預設值補齊。 */
  backgroundId?: string;
  ownedBackgroundIds?: string[];
  /** 食物庫存：買了先進背包，要自己點了餵才會消耗、換成經驗值——不是買了就直接吃掉。
   *  舊文件可能沒有這個欄位（這個欄位加進來之前建的），讀出來時用 ?? {} 補齊。 */
  foodCounts?: Record<string, number>;
  /** 已經發過的獎勵 key——結算每次進記帳本都會跑，靠這個確保同一筆獎勵只發一次。 */
  claimedKeys: string[];
  createdAt: Date;
}

export interface PetStateDTO {
  coins: number;
  xp: number;
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
  foodCounts: Record<string, number>;
  /** 這一次結算剛發出去的獎勵，給畫面上跳提示用。 */
  justEarned: PetReward[];
}

function collection() {
  return getDb().then((db) => db.collection<PetDoc>("expenses.pet"));
}

function toDTO(doc: PetDoc, justEarned: PetReward[] = []): PetStateDTO {
  return {
    coins: doc.coins,
    xp: doc.xp,
    outfitId: doc.outfitId,
    ownedOutfitIds: ownedList(doc, "服裝"),
    backgroundId: doc.backgroundId ?? DEFAULT_BACKGROUND_ID,
    ownedBackgroundIds: ownedList(doc, "背景"),
    foodCounts: doc.foodCounts ?? {},
    justEarned,
  };
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
    backgroundId: DEFAULT_BACKGROUND_ID,
    ownedBackgroundIds: [DEFAULT_BACKGROUND_ID],
    foodCounts: {},
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

/** 結算獎勵：算出還沒發過的獎勵，把幣加上去、把 key 記起來。
 *
 *  掛在每次進記帳本時跑（跟固定收支自動入帳同一個時機），而且進養成頁時 API 還會再跑
 *  一次，所以必須是冪等的——同一筆獎勵不管結算幾次都只能發一次。
 *
 *  每一筆獎勵各自用一次「條件更新」寫入：條件是「claimedKeys 裡還沒有這個 key」，所以
 *  檢查跟寫入是同一個原子操作。先前是「先讀出 claimedKeys 比對、再一次寫回」，兩個請求
 *  同時進來時會雙雙通過比對、各發一次（實際資料裡已經出現重複的 key 跟多發的星星幣）。
 *  modifiedCount 是 0 就代表這一筆被別人搶先發掉了，不算在這次的 justEarned 裡。 */
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

  const col = await collection();
  const granted: PetReward[] = [];
  for (const reward of rewards) {
    const res = await col.updateOne(
      { _id: pet._id, claimedKeys: { $ne: reward.key } },
      { $inc: { coins: reward.coins }, $push: { claimedKeys: reward.key } },
    );
    if (res.modifiedCount === 1) granted.push(reward);
  }
  if (granted.length === 0) return toDTO(pet);

  // 重新讀一次，拿到真正寫進去的幣數（這次結算可能只發了其中幾筆）。
  const updated = await col.findOne({ _id: pet._id });
  return toDTO(updated ?? pet, granted);
}

/** 買食物——先進背包，不會立刻吃掉，要另外呼叫 feedPet 才會消耗。 */
export async function buyFood(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || item.kind !== "食物") return { error: "找不到這個食物" };

  const pet = await ensurePet(userId);
  if (pet.coins < item.price) return { error: "星星幣不夠" };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $inc: { coins: -item.price, [`foodCounts.${itemId}`]: 1 } });
  return toDTO({ ...pet, coins: pet.coins - item.price, foodCounts: { ...pet.foodCounts, [itemId]: (pet.foodCounts?.[itemId] ?? 0) + 1 } });
}

/** 餵食——只能餵背包裡已經買好的，吃掉一份換成經驗值，不另外扣星星幣（買的時候已經扣過了）。 */
export async function feedPet(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || item.kind !== "食物" || !item.xp) return { error: "找不到這個食物" };

  const pet = await ensurePet(userId);
  const owned = pet.foodCounts?.[itemId] ?? 0;
  if (owned <= 0) return { error: "背包裡沒有這個食物，先去商店買" };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $inc: { xp: item.xp, [`foodCounts.${itemId}`]: -1 } });
  return toDTO({ ...pet, xp: pet.xp + item.xp, foodCounts: { ...pet.foodCounts, [itemId]: owned - 1 } });
}

/** 服裝跟背景的規則完全一樣：買一次就永久擁有、可以無限次換來換去、換的時候不用再付錢，
 *  差別只在存進文件的哪兩個欄位。所以共用同一段邏輯，不要為了兩種東西複製兩份。 */
const WEARABLES = {
  服裝: { owned: "ownedOutfitIds", current: "outfitId", missing: "還沒有這件服裝", duplicate: "這件已經有了" },
  背景: { owned: "ownedBackgroundIds", current: "backgroundId", missing: "還沒有這個背景", duplicate: "這個背景已經有了" },
} as const;

/** 服裝／背景目前擁有哪些。
 *
 *  免費的那一件（預設服裝、預設背景）一律算擁有，不管有沒有真的在清單裡——它們是每個人
 *  的起點，不該因為資料是舊格式、或 $push 在沒有這個欄位的文件上建了一個只有新東西的
 *  陣列，就變成「要再買一次」。 */
function ownedList(pet: PetDoc, kind: keyof typeof WEARABLES): string[] {
  const stored = kind === "服裝" ? pet.ownedOutfitIds : (pet.ownedBackgroundIds ?? []);
  const free = PET_ITEMS.filter((i) => i.kind === kind && i.price === 0).map((i) => i.id);
  return [...new Set([...free, ...(stored ?? [])])];
}

/** 買服裝或背景（已經有的不能重複買），買完直接換上。 */
export async function buyWearable(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || (item.kind !== "服裝" && item.kind !== "背景")) return { error: "找不到這個商品" };
  const fields = WEARABLES[item.kind];

  const pet = await ensurePet(userId);
  if (ownedList(pet, item.kind).includes(itemId)) return { error: fields.duplicate };
  if (pet.coins < item.price) return { error: "星星幣不夠" };

  const col = await collection();
  await col.updateOne(
    { _id: pet._id },
    { $inc: { coins: -item.price }, $push: { [fields.owned]: itemId }, $set: { [fields.current]: itemId } },
  );
  return toDTO({
    ...pet,
    coins: pet.coins - item.price,
    [fields.owned]: [...ownedList(pet, item.kind), itemId],
    [fields.current]: itemId,
  });
}

/** 換上已經擁有的服裝或背景。 */
export async function equipWearable(userId: ObjectId, itemId: string): Promise<PetStateDTO | { error: string }> {
  const item = petItemById(itemId);
  if (!item || (item.kind !== "服裝" && item.kind !== "背景")) return { error: "找不到這個商品" };
  const fields = WEARABLES[item.kind];

  const pet = await ensurePet(userId);
  if (!ownedList(pet, item.kind).includes(itemId)) return { error: fields.missing };

  const col = await collection();
  await col.updateOne({ _id: pet._id }, { $set: { [fields.current]: itemId } });
  return toDTO({ ...pet, [fields.current]: itemId });
}
