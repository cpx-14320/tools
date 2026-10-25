import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { accountTypeNameTaken, DEFAULT_ACCOUNT_TYPE_COLOR, type AccountKind, type AccountTypeDTO } from "./account-types";
import type { CategoryColor } from "./categories";

interface AccountTypeDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  kind: AccountKind;
  /** 顏色是後來才加的欄位，舊文件沒有，讀出來時補 DEFAULT_ACCOUNT_TYPE_COLOR。 */
  color?: CategoryColor;
  order: number;
  createdAt: Date;
  /** 系統預設建立的類型（見 presets.server.ts）——「清除全部資料」會略過。 */
  isPreset?: boolean;
}

function toDTO(doc: AccountTypeDoc): AccountTypeDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    icon: doc.icon,
    kind: doc.kind,
    color: doc.color ?? DEFAULT_ACCOUNT_TYPE_COLOR,
    isPreset: doc.isPreset,
  };
}

function collection() {
  return getDb().then((db) => db.collection<AccountTypeDoc>("expenses.accountTypes"));
}

export async function listAccountTypes(userId: ObjectId): Promise<AccountTypeDTO[]> {
  const col = await collection();
  const docs = await col.find({ userId }).sort({ kind: 1, order: 1 }).toArray();
  return docs.map(toDTO);
}

export interface AccountTypeInput {
  name: string;
  icon: string;
  kind: AccountKind;
  color: CategoryColor;
}

export async function createAccountType(
  userId: ObjectId,
  input: AccountTypeInput,
): Promise<{ accountType: AccountTypeDTO; accountTypes: AccountTypeDTO[] } | { error: string }> {
  const existing = await listAccountTypes(userId);
  if (accountTypeNameTaken(existing, input.kind, input.name)) return { error: "已經有同樣名稱的類型了，換一個名稱吧。" };

  const col = await collection();
  const order = await col.countDocuments({ userId, kind: input.kind });
  const doc: AccountTypeDoc = {
    _id: new ObjectId(),
    userId,
    name: input.name,
    icon: input.icon,
    kind: input.kind,
    color: input.color,
    order,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const accountTypes = await listAccountTypes(userId);
  return { accountType: toDTO(doc), accountTypes };
}

/** 資產／負債只有在「還沒有任何帳戶掛在這個類型底下」時才能改。
 *
 *  不是不想讓人改，是改了之後算出來的錢會是錯的：帳戶餘額的正負號看的就是它所屬類型的
 *  kind（見 accounts.ts 的 signedDelta）——資產帳戶「支出扣錢、收入加錢」，負債帳戶
 *  反過來（支出＝刷卡消費，欠更多；收入＝還款，欠更少）。把一個底下有帳戶的類型從資產
 *  翻成負債，等於把那個帳戶每一筆歷史交易的方向整個倒過來，餘額會從 +500 萬變成完全
 *  不同的數字，淨資產跟著跳動兩倍，而且沒有任何地方會提示發生了什麼事。
 *
 *  但「剛建好、還沒拿來開帳戶」的類型沒有這個問題——沒有任何資料引用它，翻面只是改一個
 *  標籤。剛建錯邊（把「定存」建成負債）正是最常見的情況，所以這種情況放行。 */
export async function updateAccountType(
  userId: ObjectId,
  id: string,
  input: { name: string; icon: string; color: CategoryColor; kind?: AccountKind },
): Promise<{ accountTypes: AccountTypeDTO[] } | { error: string }> {
  const col = await collection();
  const current = await col.findOne({ _id: new ObjectId(id), userId });
  if (!current) return { error: "找不到這個類型" };

  const nextKind = input.kind ?? current.kind;
  if (nextKind !== current.kind) {
    const inUse = await countAccountTypeUsage(userId, id);
    if (inUse > 0) {
      return {
        error: `還有 ${inUse} 個帳戶掛著這個類型，改成${nextKind === "asset" ? "資產" : "負債"}會讓那些帳戶的餘額整個反過來算。請先把帳戶改到別的類型。`,
      };
    }
  }

  // 撞名要比對「改完之後的那一邊」：從負債搬到資產時，資產那邊可能已經有同名的了。
  const existing = await listAccountTypes(userId);
  if (accountTypeNameTaken(existing, nextKind, input.name, id)) return { error: "已經有同樣名稱的類型了，換一個名稱吧。" };

  await col.updateOne(
    { _id: new ObjectId(id), userId },
    { $set: { name: input.name, icon: input.icon, color: input.color, kind: nextKind } },
  );
  return { accountTypes: await listAccountTypes(userId) };
}

/** 刪除前查一下還有幾個帳戶掛著這個類型——類型決定資產/負債跟圖示，刪除後若還有帳戶
 *  在用，那些帳戶的資產/負債判定會悄悄跑掉（查不到類型時 accountKind() 一律當成
 *  「資產」，見 accounts.ts），所以這裡直接擋下，不像分類還有「未分類」可以歸類
 *  ——帳戶類型沒有一個通用的歸宿可以自動改掛，要刪除請先把這些帳戶改成別的類型。 */
export async function countAccountTypeUsage(userId: ObjectId, id: string): Promise<number> {
  const db = await getDb();
  return db.collection("expenses.accounts").countDocuments({ userId, accountTypeId: new ObjectId(id) });
}

export async function deleteAccountType(
  userId: ObjectId,
  id: string,
): Promise<{ accountTypes: AccountTypeDTO[] } | { error: string; inUseCount: number }> {
  const inUseCount = await countAccountTypeUsage(userId, id);
  if (inUseCount > 0) return { error: "帳戶類型仍有帳戶使用中", inUseCount };

  const col = await collection();
  await col.deleteOne({ _id: new ObjectId(id), userId });
  return { accountTypes: await listAccountTypes(userId) };
}
