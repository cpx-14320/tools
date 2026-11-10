import { ObjectId, type Db, type Document } from "mongodb";
import { getDb } from "../mongodb";
import type { TrashItemDTO, TrashKind } from "./trash";
import type { CategoryColor } from "./categories";

/** 垃圾桶裡的一筆「刪除動作」。一次使用者操作 ＝ 一個項目 ＝ 一次還原。
 *
 *  `entries` 是陣列因為有些刪除會連帶移除好幾個文件（刪分類會連子分類跟它們的預算規則
 *  一起）。拆成多筆的話會出現「還原了分類但預算規則沒回來」這種半套狀態。 */
interface TrashDoc {
  _id: ObjectId;
  userId: ObjectId;
  deletedAt: Date;
  kind: TrashKind;
  label: string;
  sublabel?: string;
  /** 刪除當下那一列的圖示與顏色（見 trash.ts 的 TrashItemDTO）。舊資料沒有這兩個欄位，
   *  畫面上會退回「依種類給一張預設圖」。 */
  icon?: string;
  color?: CategoryColor;
  entries: { collection: string; doc: Document }[];
  /** 刪分類時被改掛到「未分類」的那幾筆交易／固定收支。
   *
   *  這是整個垃圾桶唯一一個「文件以外的副作用」：刪分類不只刪掉分類本身，還會把它底下
   *  的交易全部改掛到未分類。沒有這份清單的話，還原分類之後那些交易會留在未分類裡，
   *  而且**分不出哪幾筆是這次被搬過去的**（未分類裡本來就可能有別的交易）。 */
  reassigned?: { collection: string; ids: ObjectId[]; fromCategoryId: ObjectId }[];
}

function collection() {
  return getDb().then((db) => db.collection<TrashDoc>("expenses.trash"));
}

function toDTO(doc: TrashDoc): TrashItemDTO {
  return {
    id: doc._id.toHexString(),
    deletedAt: doc.deletedAt.toISOString(),
    kind: doc.kind,
    label: doc.label,
    sublabel: doc.sublabel,
    icon: doc.icon,
    color: doc.color,
    docCount: doc.entries.length,
  };
}

/** 新的排前面。 */
export async function listTrash(userId: ObjectId): Promise<TrashItemDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ deletedAt: -1 }).toArray();
  return docs.map(toDTO);
}

export async function countTrash(userId: ObjectId): Promise<number> {
  const col = await collection();
  return col.countDocuments({ userId });
}

/** 把一次刪除存進垃圾桶，回傳垃圾桶項目的 id（給 Undo toast 用）。
 *
 *  **不設過期**：這些是使用者自己的資料，自己消失會嚇到人。只能由使用者手動刪掉
 *  （單筆「永久刪除」或「清空垃圾桶」）。 */
export async function putInTrash(
  userId: ObjectId,
  input: {
    kind: TrashKind;
    label: string;
    sublabel?: string;
    icon?: string;
    color?: CategoryColor;
    entries: { collection: string; doc: Document }[];
    reassigned?: { collection: string; ids: ObjectId[]; fromCategoryId: ObjectId }[];
  },
): Promise<string> {
  const col = await collection();
  const _id = new ObjectId();
  await col.insertOne({
    _id,
    userId,
    deletedAt: new Date(),
    kind: input.kind,
    label: input.label,
    sublabel: input.sublabel,
    icon: input.icon,
    color: input.color,
    entries: input.entries,
    reassigned: input.reassigned,
  });
  return _id.toHexString();
}

export interface RestoreResult {
  ok: boolean;
  /** 還原時因為撞名而被改過的名字，例如 `餐飲(2)`。畫面上要告訴使用者。 */
  renamedTo?: string;
  /** 參照的帳戶／分類已經不在了，那個欄位被清掉的筆數。 */
  droppedRefs?: number;
  error?: string;
}

/** 同名時自動加序號：`餐飲` → `餐飲(2)` → `餐飲(3)`…
 *
 *  **為什麼是自動改名而不是擋下來**：還原的目的是把東西拿回來，因為撞名就不給還原等於
 *  讓使用者卡住。而帶著 `(2)` 的名字本身就是線索——使用者看得出「這是還原回來的那個」，
 *  可以去明細頁篩出它底下的紀錄、批次改到正確的分類，再把 `(1)` 這個刪掉。
 *  掛到「未分類」就做不到這件事：那裡面混著各種來源，人工分不出哪筆是哪個分類的。 */
async function uniqueName(
  col: Awaited<ReturnType<typeof getDb>>,
  collectionName: string,
  filter: Document,
  base: string,
): Promise<string> {
  const existing = await col
    .collection(collectionName)
    .find({ ...filter, name: { $regex: `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\(\\d+\\))?$` } })
    .toArray();
  if (!existing.some((d) => d.name === base)) return base;
  // 從 (1) 開始：原本那個沒有數字，加上去的這些就是「第幾個重複的」。
  for (let n = 1; n < 1000; n++) {
    const candidate = `${base}(${n})`;
    if (!existing.some((d) => d.name === candidate)) return candidate;
  }
  return `${base}(${Date.now()})`;
}

/** 哪些集合的「名稱」不能重複——還原時要先檢查、必要時改名。 */
const NAME_SCOPED: Record<string, (doc: Document, userId: ObjectId) => Document> = {
  "expenses.categories": (doc, userId) => ({ userId, kind: doc.kind, parentId: doc.parentId ?? null }),
  "expenses.accounts": (doc, userId) => ({ userId }),
  "expenses.accountTypes": (doc, userId) => ({ userId, kind: doc.kind }),
};

/** 每個集合裡「指向別的東西」的欄位，還原時要確認那個東西還在。
 *
 *  `drop`＝選填欄位，指向的東西不在就把欄位拿掉；`uncategorized`＝必填欄位，清掉會變成
 *  壞資料，改掛到「未分類」。
 *
 *  **為什麼只列這幾個**：斷掉的參照分兩種。一種只是顯示不出名字（轉帳的轉出／轉入帳戶
 *  被刪掉，畫面上就是「（已刪除帳戶）」，帳戶還原回來它又正常了），那種留著反而對——
 *  硬清掉的話帳戶救回來也接不回去。另一種會把壞資料往前傳：分類的預設帳戶指向一個不
 *  存在的帳戶，之後每次用這個分類記帳都會預選那個死帳戶；固定收支的 linkedGoalId 指向
 *  不存在的目標，每期入帳都會對它做一次沒有作用的加總，而且**完全沒有任何徵兆**。
 *  這張表只收第二種。 */
const REF_FIELDS: Record<string, { field: string; collection: string; onMissing: "drop" | "uncategorized" }[]> = {
  "expenses.transactions": [
    { field: "accountId", collection: "expenses.accounts", onMissing: "drop" },
    { field: "categoryId", collection: "expenses.categories", onMissing: "uncategorized" },
  ],
  "expenses.recurringRules": [
    { field: "accountId", collection: "expenses.accounts", onMissing: "drop" },
    { field: "categoryId", collection: "expenses.categories", onMissing: "uncategorized" },
    { field: "linkedGoalId", collection: "expenses.goals", onMissing: "drop" },
  ],
  "expenses.categories": [{ field: "defaultAccountId", collection: "expenses.accounts", onMissing: "drop" }],
  "expenses.goals": [{ field: "accountId", collection: "expenses.accounts", onMissing: "drop" }],
  "expenses.budgets": [{ field: "categoryId", collection: "expenses.categories", onMissing: "uncategorized" }],
};

/** 有「order」欄位、而且 order 只在同一層裡才有意義的集合——還原時要確認那個位置還空著。 */
const ORDER_SCOPED: Record<string, (doc: Document, userId: ObjectId) => Document> = {
  "expenses.categories": (doc, userId) => ({ userId, kind: doc.kind, parentId: doc.parentId ?? null }),
  "expenses.accountTypes": (doc, userId) => ({ userId, kind: doc.kind }),
};

/** 還原時決定這筆要用哪個 order。
 *
 *  **原本的位置還空著就放回原位**：刪錯了馬上按還原是最常見的情況，那時候原本的位置
 *  就是一個洞，放回去使用者看到的就是「什麼都沒發生」，這才是還原該有的樣子。
 *
 *  **被佔走了就排到最後**：刪掉之後又排序過的話，整層已經被重新編號成 0,1,2,…，原本
 *  那個數字現在是別人的。硬插回去會變成兩筆同號、並列在一起，位置由資料庫決定——就是
 *  新增分類時那個「排不到最後」的老問題換一條路發生。排到最後至少是確定的，而且看得
 *  出來「它回來了」。
 *
 *  刻意不去推開別人（把 ≥ 原位的那些整批往後挪）：使用者在刪除之後特地排過一次順序，
 *  那是他明確表達過的意思，不該為了讓一筆還原的資料回到舊位置就把整層推一遍。 */
async function restoreOrder(db: Db, collection: string, doc: Document, userId: ObjectId): Promise<number | undefined> {
  const scope = ORDER_SCOPED[collection];
  if (!scope || typeof doc.order !== "number") return undefined;
  const filter = scope(doc, userId);
  const taken = await db.collection(collection).countDocuments({ ...filter, order: doc.order }, { limit: 1 });
  if (taken === 0) return doc.order;
  const last = await db.collection(collection).find(filter).sort({ order: -1 }).limit(1).next();
  return last ? Number(last.order) + 1 : 0;
}

/** 還原之前先問「這幾項還原的話會變成什麼樣子」。
 *
 *  **為什麼要有這支**：撞名時還原會自動加序號，但那是做完才知道的事——使用者按下還原
 *  是期待「東西回到原本的樣子」，結果回來的叫「飲食(1)」。先問一次，他才有機會取消、
 *  去把現有的那個改名或刪掉，再回來還原。
 *
 *  只回報會改名的那幾項；名稱沒衝突的不用講，講了只是噪音。 */
export async function previewRestore(userId: ObjectId, trashIds: string[]): Promise<{ id: string; label: string; renamedTo: string }[]> {
  const col = await collection();
  const db = await getDb();
  const out: { id: string; label: string; renamedTo: string }[] = [];

  for (const trashId of trashIds) {
    if (!ObjectId.isValid(trashId)) continue;
    const item = await col.findOne({ _id: new ObjectId(trashId), userId });
    if (!item) continue;
    for (const entry of item.entries) {
      const doc = entry.doc as Document;
      const scope = NAME_SCOPED[entry.collection];
      if (!scope || typeof doc.name !== "string") continue;
      const next = await uniqueName(db, entry.collection, scope(doc, userId), doc.name);
      if (next !== doc.name) out.push({ id: trashId, label: doc.name, renamedTo: next });
    }
  }
  return out;
}

export async function restoreFromTrash(userId: ObjectId, trashId: string): Promise<RestoreResult> {
  if (!ObjectId.isValid(trashId)) return { ok: false, error: "找不到這一項" };
  const col = await collection();
  const item = await col.findOne({ _id: new ObjectId(trashId), userId });
  if (!item) return { ok: false, error: "這一項已經還原過了，或是已經被永久刪除" };

  const db = await getDb();
  let renamedTo: string | undefined;
  let droppedRefs = 0;

  for (const entry of item.entries) {
    const doc = { ...entry.doc } as Document;

    // 撞名就自動加序號（見 uniqueName）。
    const scope = NAME_SCOPED[entry.collection];
    if (scope && typeof doc.name === "string") {
      const next = await uniqueName(db, entry.collection, scope(doc, userId), doc.name);
      if (next !== doc.name) {
        renamedTo = next;
        doc.name = next;
      }
    }

    // 原本的位置被佔走了就排到最後（見 restoreOrder）。
    const order = await restoreOrder(db, entry.collection, doc, userId);
    if (order !== undefined) doc.order = order;

    // 參照的東西已經不在了（刪掉分類之後又把它的預設帳戶也刪了，諸如此類）就處理掉，
    // 不要插一筆指向不存在資料的紀錄。走 REF_FIELDS 這張表而不是在這裡逐一判斷：
    // 「刪了什麼又還原什麼」的組合會隨著欄位變多而爆炸，集中成一張表才不會每加一個
    // 參照欄位就要重想一次所有組合。
    for (const ref of REF_FIELDS[entry.collection] ?? []) {
      const value = doc[ref.field];
      if (!(value instanceof ObjectId)) continue;
      const exists = await db.collection(ref.collection).countDocuments({ _id: value, userId }, { limit: 1 });
      if (exists > 0) continue;
      if (ref.onMissing === "uncategorized") {
        // 分類是必填欄位，清掉會變成壞資料——改掛到「未分類」。
        const uncategorized = await db.collection("expenses.categories").findOne({ userId, isUncategorized: true });
        if (uncategorized) doc[ref.field] = uncategorized._id;
      } else {
        delete doc[ref.field];
      }
      droppedRefs++;
    }

    // 用原本的 _id 插回去。重複還原會在這裡撞 duplicate key，是天然的防護。
    try {
      await db.collection(entry.collection).insertOne(doc);
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== 11000) throw e; // 11000 ＝ 已經存在，當成已還原
    }
  }

  // 刪分類時被改掛到未分類的那幾筆，改回原本的分類。
  for (const group of item.reassigned ?? []) {
    await db
      .collection(group.collection)
      .updateMany({ userId, _id: { $in: group.ids }, categoryId: { $ne: group.fromCategoryId } }, { $set: { categoryId: group.fromCategoryId } });
  }

  await col.deleteOne({ _id: item._id, userId });
  return { ok: true, renamedTo, droppedRefs };
}

export async function purgeTrashItem(userId: ObjectId, trashId: string): Promise<void> {
  if (!ObjectId.isValid(trashId)) return;
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(trashId), userId });
}

export async function emptyTrash(userId: ObjectId): Promise<number> {
  const col = await collection();
  const result = await col.deleteMany({ userId });
  return result.deletedCount;
}
