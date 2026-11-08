import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import type { AiDraftDTO, AiDraftItemDTO, AiDraftSource, AiDraftStatus } from "./ai-drafts";

interface AiDraftDoc {
  _id: ObjectId;
  userId: ObjectId;
  createdAt: Date;
  source: AiDraftSource;
  inputSummary: string;
  /** 原始輸入全文。列表上只顯示摘要，但「這一批到底是從哪句話來的」在想重跑或調 prompt
   *  時會需要，而且它不佔空間。 */
  inputText: string;
  model: string;
  status: AiDraftStatus;
  items: AiDraftItemDTO[];
}

function collection() {
  return getDb().then((db) => db.collection<AiDraftDoc>("expenses.aiDrafts"));
}

function toDTO(doc: AiDraftDoc): AiDraftDTO {
  return {
    id: doc._id.toHexString(),
    createdAt: doc.createdAt.toISOString(),
    source: doc.source,
    inputSummary: doc.inputSummary,
    model: doc.model,
    status: doc.status,
    items: doc.items,
  };
}

/** 新的排前面：待確認清單要先看到剛解析出來的那一批。 */
export async function listAiDrafts(userId: ObjectId): Promise<AiDraftDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toDTO);
}

export async function createAiDraft(
  userId: ObjectId,
  input: { source: AiDraftSource; inputSummary: string; inputText: string; model: string; items: AiDraftItemDTO[] },
): Promise<AiDraftDTO> {
  const col = await collection();
  const doc: AiDraftDoc = {
    _id: new ObjectId(),
    userId,
    createdAt: new Date(),
    source: input.source,
    inputSummary: input.inputSummary,
    inputText: input.inputText,
    model: input.model,
    status: "pending",
    items: input.items,
  };
  await col.insertOne(doc);
  return toDTO(doc);
}

/** 同一段輸入在短時間內重送，直接把上一批還給他，不要再花一次錢。
 *
 *  前端已經在送出中 disable 按鈕了，但那擋不住「按了沒反應以為沒送出、重新整理再按一次」
 *  這種人之常情。10 分鐘是個折衷：短到不會擋住「我真的想重跑一次看看會不會判得比較好」，
 *  長到足以涵蓋一次網路卡頓加重試。 */
export async function findRecentAiDraft(userId: ObjectId, inputText: string, withinMs = 10 * 60 * 1000): Promise<AiDraftDTO | null> {
  const col = await collection();
  const doc = await col.findOne({ userId, inputText, status: "pending", createdAt: { $gte: new Date(Date.now() - withinMs) } });
  return doc ? toDTO(doc) : null;
}

/** 不看時間、也不看狀態，只問「這段輸入以前處理過沒有」。
 *
 *  發票專用：同一張發票的號碼是唯一的，掃第二次就該擋下來。上面那個 findRecentAiDraft
 *  只擋十分鐘內、還沒處理完的，對「上禮拜就記過這張了」沒有用——而重複記帳是使用者
 *  自己很難發現的錯誤（金額對、日期對，只是多了一筆）。 */
export async function findAiDraftByInput(userId: ObjectId, inputText: string): Promise<AiDraftDTO | null> {
  const col = await collection();
  const doc = await col.findOne({ userId, inputText }, { sort: { createdAt: -1 } });
  return doc ? toDTO(doc) : null;
}

export async function getAiDraft(userId: ObjectId, id: string): Promise<AiDraftDTO | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await collection();
  const doc = await col.findOne({ _id: new ObjectId(id), userId });
  return doc ? toDTO(doc) : null;
}

/** 改其中一筆（補分類、改金額、改日期…）或把它標成略過。
 *
 *  用 `items.$[item]` 的 arrayFilters 定位，不是把整個 items 陣列讀出來改完寫回去：
 *  後者在兩個分頁同時開著同一批時，後寫的那邊會把前面的修改整個蓋掉。 */
export async function updateAiDraftItem(
  userId: ObjectId,
  draftId: string,
  key: string,
  patch: Partial<Pick<AiDraftItemDTO, "categoryId" | "amount" | "date" | "note" | "accountId" | "state">>,
): Promise<AiDraftDTO | null> {
  if (!ObjectId.isValid(draftId)) return null;
  const col = await collection();
  const set: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) set[`items.$[item].${field}`] = value;
  if (Object.keys(set).length > 0) {
    await col.updateOne({ _id: new ObjectId(draftId), userId }, { $set: set }, { arrayFilters: [{ "item.key": key }] });
  }
  return getAiDraft(userId, draftId);
}

/** 整批標成已寫入／已捨棄。還沒處理的那幾筆也一起收尾，不然批次會卡在「還有 2 筆待確認」
 *  但實際上使用者已經決定不要了。 */
export async function closeAiDraft(userId: ObjectId, draftId: string, status: "committed" | "discarded"): Promise<void> {
  if (!ObjectId.isValid(draftId)) return;
  const col = await collection();
  await col.updateOne(
    { _id: new ObjectId(draftId), userId },
    { $set: { status, "items.$[pending].state": status === "committed" ? "committed" : "skipped" } },
    { arrayFilters: [{ "pending.state": "pending" }] },
  );
}

export async function deleteAiDraft(userId: ObjectId, draftId: string): Promise<void> {
  if (!ObjectId.isValid(draftId)) return;
  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(draftId), userId });
}

/** 清掉已經處理完的批次。刻意不做自動過期刪除：這些是花錢產生的東西，自己消失會嚇到人，
 *  由使用者自己按「清掉已處理的」。 */
export async function deleteClosedAiDrafts(userId: ObjectId): Promise<number> {
  const col = await collection();
  const result = await col.deleteMany({ userId, status: { $in: ["committed", "discarded"] } });
  return result.deletedCount;
}
