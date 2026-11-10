import { ObjectId, type Collection, type Filter } from "mongodb";
import { getDb } from "../mongodb";
import { categoryNameTaken, type CategoryColor, type CategoryDTO, type CategoryKind } from "./categories";
import { deleteBudgetRulesForCategories } from "./budgets.server";
import { FEE_CATEGORY_NAME, ICON_FEE, ICON_UNCATEGORIZED } from "./presets";
import { putInTrash } from "./trash.server";

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
  isFee?: boolean;
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
    isFee: doc.isFee,
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

/** 新項目要排在最後面，order 給「目前最大的 order ＋ 1」。
 *
 *  **不能用「目前有幾筆」當 order**：刪掉中間某一筆之後，剩下的 order 不會重新編號，
 *  於是出現 0,1,2,4,5… 這種有洞的序列——筆數變成 5，但最大的 order 是 5，新的那筆拿到
 *  5 就跟既有的那筆撞在一起，排序時並列，看起來就是「新增的分類跑回它被刪掉之前的位置」。
 *  實際踩過：刪掉「飲料」再新增，它沒有排到最後，而是卡在清單中間。 */
async function nextOrder(col: Collection<CategoryDoc>, filter: Filter<CategoryDoc>): Promise<number> {
  const last = await col.find(filter).sort({ order: -1 }).limit(1).next();
  return last ? Number(last.order) + 1 : 0;
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

  const order = await nextOrder(col, { userId, parentId, kind });
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
  const order = await nextOrder(col, { userId, parentId: null, kind });
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

/** 找不到就建一個支出分類「手續費」回傳 id——轉帳的手續費會記成一筆掛在這裡的支出。
 *
 *  **為什麼手續費要變成一筆支出**：轉帳本身不影響淨資產（錢只是從一個戶頭搬到另一個），
 *  但手續費是真的消失的錢。不記成支出的話，轉出 1000、轉入 985 那 15 元會變成憑空蒸發，
 *  帳戶餘額對不上、報表也看不到這筆開銷。
 *
 *  **為什麼自動建而不是讓使用者選分類**：記一筆轉帳的時候要求順便挑一個手續費分類，
 *  是把實作細節丟給使用者。名稱固定「手續費」，使用者之後要改名、換圖示、搬動排序都
 *  可以（這裡只在「找不到同名的」時候才建），跟「未分類」同一個做法。 */
export async function ensureFeeCategory(userId: ObjectId): Promise<ObjectId> {
  const col = await collection();
  // 先用旗標找。改名之後還是找得到同一個，不會再建一個新的。
  const flagged = await col.findOne({ userId, isFee: true });
  if (flagged) return flagged._id;
  // 旗標是後來才加的，舊資料只有名字——找到就補上旗標，之後就走上面那條路。
  const legacy = await col.findOne({ userId, kind: "支出", parentId: null, name: FEE_CATEGORY_NAME });
  if (legacy) {
    await col.updateOne({ _id: legacy._id }, { $set: { isFee: true } });
    return legacy._id;
  }
  const order = await nextOrder(col, { userId, parentId: null, kind: "支出" });
  const doc: CategoryDoc = {
    _id: new ObjectId(),
    userId,
    name: FEE_CATEGORY_NAME,
    icon: ICON_FEE,
    color: "b",
    kind: "支出",
    parentId: null,
    order,
    createdAt: new Date(),
    isFee: true,
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
): Promise<{ categories: CategoryDTO[]; trashId?: string } | { error: string; inUseCount: number }> {
  const col = await collection();
  const target = new ObjectId(id);

  // 「未分類」是刪除別的分類時的歸宿，自己被刪掉的話那些紀錄又會變成孤兒資料。
  const targetDocForGuard = await col.findOne({ _id: target, userId });
  if (targetDocForGuard?.isUncategorized) {
    return { error: "「未分類」是系統用來收容已刪除分類紀錄的地方，不能刪除", inUseCount: 0 };
  }
  // 手續費同理：轉帳只要填了手續費就會往這裡記一筆，刪掉之後下次記帳又會自動建一個，
  // 而舊的那些手續費紀錄會被丟到「未分類」，等於白白把帳弄亂。
  if (targetDocForGuard?.isFee) {
    return { error: "「手續費」是轉帳手續費要記的地方，不能刪除", inUseCount: 0 };
  }

  const db = await getDb();
  // 被改掛到「未分類」的那幾筆要記下來，還原時才改得回去。
  //
  // 這是整個垃圾桶唯一一個「文件以外的副作用」：刪分類不只刪掉分類本身，還會把它底下
  // 所有交易搬到未分類。沒有這份清單的話，還原分類之後那些交易會留在未分類裡，而且
  // **分不出哪幾筆是這次被搬過去的**——未分類裡本來就混著各種來源的紀錄，要人工一筆
  // 一筆回想原本是什麼分類，那比重記一次還痛苦。
  const reassigned: { collection: string; ids: ObjectId[]; fromCategoryId: ObjectId }[] = [];

  if (!options?.force) {
    const inUseCount = await countCategoryUsage(userId, id);
    if (inUseCount > 0) return { error: "分類仍有使用中的紀錄", inUseCount };
  } else {
    const targetDoc = await col.findOne({ _id: target, userId });
    if (targetDoc) {
      const subs = await col.find({ userId, parentId: target }, { projection: { _id: 1 } }).toArray();
      const ids = [target, ...subs.map((s) => s._id)];
      const uncategorizedId = await ensureUncategorized(userId, targetDoc.kind);
      // 先把「等一下會被搬走的是哪幾筆」抓下來，搬完就查不到了。子分類的紀錄還原時
      // 要回到它原本那個子分類，所以一個分類一組、不是全部混在一起。
      for (const collectionName of ["expenses.transactions", "expenses.recurringRules"]) {
        for (const categoryId of ids) {
          const docs = await db.collection(collectionName).find({ userId, categoryId }, { projection: { _id: 1 } }).toArray();
          if (docs.length > 0) reassigned.push({ collection: collectionName, ids: docs.map((d) => d._id), fromCategoryId: categoryId });
        }
      }
      await Promise.all([
        db.collection("expenses.transactions").updateMany({ userId, categoryId: { $in: ids } }, { $set: { categoryId: uncategorizedId } }),
        db.collection("expenses.recurringRules").updateMany({ userId, categoryId: { $in: ids } }, { $set: { categoryId: uncategorizedId } }),
      ]);
    }
  }

  // 連這個分類（跟它的子分類）的預算規則一起清掉，不留下指向不存在分類的孤兒設定。
  const subsForBudget = await col.find({ userId, parentId: target }, { projection: { _id: 1 } }).toArray();
  const budgetDocs = await db
    .collection("expenses.budgets")
    .find({ userId, categoryId: { $in: [target, ...subsForBudget.map((s) => s._id)] } })
    .toArray();
  await deleteBudgetRulesForCategories(userId, [target, ...subsForBudget.map((s) => s._id)]);

  // 分類本體＋子分類＋預算規則全部存成同一個垃圾桶項目：一次刪除就該是一次還原，
  // 拆開會出現「分類回來了但預算規則沒回來」這種半套狀態。
  const toDelete = await col.find({ userId, $or: [{ _id: target }, { parentId: target }] }).toArray();
  const mainDoc = toDelete.find((d) => d._id.equals(target));
  let trashId: string | undefined;
  if (mainDoc) {
    const subCount = toDelete.length - 1;
    trashId = await putInTrash(userId, {
      kind: "category",
      label: mainDoc.name,
      icon: mainDoc.icon,
      color: mainDoc.color,
      sublabel: [mainDoc.kind, subCount > 0 ? `含 ${subCount} 個子分類` : null, budgetDocs.length > 0 ? `含 ${budgetDocs.length} 筆預算` : null]
        .filter(Boolean)
        .join(" · "),
      entries: [
        ...toDelete.map((doc) => ({ collection: "expenses.categories", doc })),
        ...budgetDocs.map((doc) => ({ collection: "expenses.budgets", doc })),
      ],
      reassigned,
    });
  }

  await col.deleteMany({ userId, $or: [{ _id: target }, { parentId: target }] });
  return { categories: await listCategories(userId), trashId };
}
