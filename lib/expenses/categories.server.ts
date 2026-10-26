import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { categoryNameTaken, type CategoryColor, type CategoryDTO, type CategoryKind } from "./categories";
import { deleteBudgetRulesForCategories } from "./budgets.server";
import { ICON_UNCATEGORIZED } from "./presets";

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
  budgetAmount?: number;
  /** 記一筆新紀錄選到這個分類時自動帶上的帳戶（只設在頂層分類，見 categories.ts）。 */
  defaultAccountId?: ObjectId;
  /** 系統第一次幫使用者建立的預設分類（見 presets.server.ts）——「清除全部資料」會
   *  略過這些，不會把每個人記帳的起點也一起拆掉。 */
  isPreset?: boolean;
  /** 刪除分類時，既有紀錄被強制歸類到「未分類」留下的標記——純粹讓畫面知道這是系統
   *  自動生成的歸宿分類，不是使用者自己建的，目前還沒有特殊 UI 處理，先記著備用。 */
  isUncategorized?: boolean;
}

function toDTO(doc: CategoryDoc): CategoryDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    kind: doc.kind,
    parentId: doc.parentId?.toHexString(),
    budgetAmount: doc.budgetAmount,
    defaultAccountId: doc.defaultAccountId?.toHexString(),
    isPreset: doc.isPreset,
    isUncategorized: doc.isUncategorized,
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
  // 子分類的收支類型、圖示、顏色一律跟著父分類走，使用者不自己挑（見 categories.ts 的
  // displayCategoryOf：子分類在畫面上本來就是用父分類那顆圖示跟顏色，自己存一組只會跟
  // 畫面對不起來）。呼叫端送什麼進來都以父分類為準，不是「沒送才補」。
  let icon = input.icon;
  let color = input.color;
  if (input.parentId) {
    const parent = await col.findOne({ _id: new ObjectId(input.parentId), userId, parentId: null });
    if (!parent) return { error: "找不到要新增子分類的父分類" };
    parentId = parent._id;
    kind = parent.kind;
    icon = parent.icon;
    color = parent.color;
  }

  const existing = await listCategories(userId);
  if (categoryNameTaken(existing, input.name, { kind, parentId: parentId?.toHexString() })) {
    return { error: "已經有同樣名稱的分類了，換一個名稱吧。" };
  }

  const order = await col.countDocuments({ userId, parentId, kind });
  const doc: CategoryDoc = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    icon,
    color,
    kind,
    parentId,
    order,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const categories = await listCategories(userId);
  return { category: toDTO(doc), categories };
}

/** 重排同一層的分類——`ids` 是那一層排好的完整順序，`order` 直接寫成陣列索引。
 *
 *  送整串而不是「跟上一個交換」：交換要兩次寫入、中間失敗就會留下兩個一樣的 order，
 *  而且沒辦法修正舊資料裡本來就重複或跳號的 order。整串重寫是冪等的，每存一次順便
 *  把那一層的 order 正規化成 0..n-1。
 *
 *  只會動 `ids` 裡面的那幾筆，而且一定要屬於同一個使用者——前端送進來的 id 不可信，
 *  用 userId 一起當條件，別人的分類不會被重排。 */
export async function reorderCategories(userId: ObjectId, ids: string[]): Promise<CategoryDTO[]> {
  if (ids.length > 0) {
    const col = await collection();
    await col.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: new ObjectId(id), userId }, update: { $set: { order: index } } },
      })),
    );
  }
  return listCategories(userId);
}

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  color?: CategoryColor;
  /** undefined＝這次編輯不動預算欄位；null＝明確清掉預算；數字＝設定/修改預算。
   *  跟 name／icon／color 不同，這個欄位需要區分「沒傳」跟「傳了但要清空」兩種情況，
   *  所以不能套用下面同一招「過濾掉 undefined 就丟進 $set」。 */
  budgetAmount?: number | null;
  /** 同上，要區分「沒傳」跟「傳了但要清掉」：undefined＝不動，null＝清掉預設帳戶，
   *  字串＝設成那個帳戶。 */
  defaultAccountId?: string | null;
}

export async function updateCategory(
  userId: ObjectId,
  id: string,
  input: UpdateCategoryInput,
): Promise<{ categories: CategoryDTO[] } | { error: string }> {
  const col = await collection();

  if (input.name) {
    const current = await col.findOne({ _id: new ObjectId(id), userId });
    if (current) {
      const existing = await listCategories(userId);
      if (categoryNameTaken(existing, input.name, { kind: current.kind, parentId: current.parentId?.toHexString() }, id)) {
        return { error: "已經有同樣名稱的分類了，換一個名稱吧。" };
      }
    }
  }

  const { budgetAmount, defaultAccountId, ...rest } = input;
  // 子分類編輯時不會送 color（顏色跟父分類一致、不能自己改），這裡要過濾掉 undefined 欄位，
  // 不然 $set 可能把欄位整個設成 null，蓋掉原本繼承來的顏色。
  const fields: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (typeof budgetAmount === "number") fields.budgetAmount = budgetAmount;
  if (typeof defaultAccountId === "string" && defaultAccountId) fields.defaultAccountId = new ObjectId(defaultAccountId);

  // budgetAmount 不能跟 name/icon/color 一樣直接丟進同一個過濾流程：$set 跟 $unset
  // 不能同時出現在同一個欄位上，null 代表「清空」要走 $unset，不能也留在 $set 裡。
  const update: Record<string, unknown> = {};
  if (Object.keys(fields).length > 0) update.$set = fields;
  const unset: Record<string, string> = {};
  if (budgetAmount === null) unset.budgetAmount = "";
  if (defaultAccountId === null || defaultAccountId === "") unset.defaultAccountId = "";
  if (Object.keys(unset).length > 0) update.$unset = unset;
  if (Object.keys(update).length > 0) {
    await col.updateOne({ _id: new ObjectId(id), userId }, update);
  }

  // 改了父分類的圖示／顏色，底下的子分類要跟著改——子分類是「沿用父分類的樣子」，存的是
  // 複製過來的值，不跟著更新的話畫面上會出現同一群分類兩種顏色。
  const inherited: Record<string, unknown> = {};
  if (fields.icon !== undefined) inherited.icon = fields.icon;
  if (fields.color !== undefined) inherited.color = fields.color;
  if (Object.keys(inherited).length > 0) {
    await col.updateMany({ userId, parentId: new ObjectId(id) }, { $set: inherited });
  }

  return { categories: await listCategories(userId) };
}

/** 刪除分類（含子分類）前，這個分類／子分類底下還有幾筆交易或固定收支規則在用——
 *  不計入就刪，這些紀錄會變成查無分類的孤兒資料，連帶讓支出/收入統計算錯（查無分類
 *  的交易會被誤判成支出，詳見 transactions.ts 的 totalsForRange）。 */
export async function countCategoryUsage(userId: ObjectId, id: string): Promise<number> {
  const db = await getDb();
  const col = await collection();
  const target = new ObjectId(id);
  const subs = await col.find({ userId, parentId: target }, { projection: { _id: 1 } }).toArray();
  const ids = [target, ...subs.map((s) => s._id)];
  const [txCount, ruleCount] = await Promise.all([
    db.collection("expenses.transactions").countDocuments({ userId, categoryId: { $in: ids } }),
    db.collection("expenses.recurringRules").countDocuments({ userId, categoryId: { $in: ids } }),
  ]);
  return txCount + ruleCount;
}

/** 找不到就建一個「未分類」分類回傳 id——刪除一個還有紀錄在用的分類時，這些紀錄會被
 *  強制歸類到這裡，而不是留著查無分類的孤兒 categoryId。每個收支方向（支出/收入）各自
 *  一個，名稱固定「未分類」，重複呼叫也不會建出第二個（用名稱＋kind 查過一輪才建）。 */
async function ensureUncategorized(userId: ObjectId, kind: CategoryKind): Promise<ObjectId> {
  const col = await collection();
  const existing = await col.findOne({ userId, kind, parentId: null, name: "未分類" });
  if (existing) return existing._id;
  const order = await col.countDocuments({ userId, parentId: null, kind });
  const doc: CategoryDoc = {
    _id: new ObjectId(),
    userId,
    name: "未分類",
    icon: ICON_UNCATEGORIZED,
    color: "f",
    kind,
    parentId: null,
    order,
    createdAt: new Date(),
    isUncategorized: true,
  };
  await col.insertOne(doc);
  return doc._id;
}

/** 刪除大分類會連同底下的子分類一起刪掉。預設（force=false）如果還有交易/固定收支規則
 *  引用這個分類（或它的子分類），不會真的刪除，回傳 { error, inUseCount } 讓呼叫端先問過
 *  使用者；force=true 才會真的刪，刪之前先把那些紀錄的 categoryId 改成「未分類」，
 *  不留孤兒資料。 */
export async function deleteCategory(
  userId: ObjectId,
  id: string,
  options?: { force?: boolean },
): Promise<{ categories: CategoryDTO[] } | { error: string; inUseCount: number }> {
  const col = await collection();
  const target = new ObjectId(id);

  // 「未分類」是刪除別的分類時的歸宿，自己被刪掉的話那些紀錄又會變成孤兒資料。
  const targetDocForGuard = await col.findOne({ _id: target, userId });
  if (targetDocForGuard?.isUncategorized) {
    return { error: "「未分類」是系統用來收容已刪除分類紀錄的地方，不能刪除", inUseCount: 0 };
  }

  if (!options?.force) {
    const inUseCount = await countCategoryUsage(userId, id);
    if (inUseCount > 0) return { error: "分類仍有使用中的紀錄", inUseCount };
  } else {
    const targetDoc = await col.findOne({ _id: target, userId });
    if (targetDoc) {
      const subs = await col.find({ userId, parentId: target }, { projection: { _id: 1 } }).toArray();
      const ids = [target, ...subs.map((s) => s._id)];
      const uncategorizedId = await ensureUncategorized(userId, targetDoc.kind);
      const db = await getDb();
      await Promise.all([
        db.collection("expenses.transactions").updateMany({ userId, categoryId: { $in: ids } }, { $set: { categoryId: uncategorizedId } }),
        db.collection("expenses.recurringRules").updateMany({ userId, categoryId: { $in: ids } }, { $set: { categoryId: uncategorizedId } }),
      ]);
    }
  }

  // 連這個分類（跟它的子分類）的預算規則一起清掉，不留下指向不存在分類的孤兒設定。
  const subsForBudget = await col.find({ userId, parentId: target }, { projection: { _id: 1 } }).toArray();
  await deleteBudgetRulesForCategories(userId, [target, ...subsForBudget.map((s) => s._id)]);

  await col.deleteMany({ userId, $or: [{ _id: target }, { parentId: target }] });
  return { categories: await listCategories(userId) };
}
