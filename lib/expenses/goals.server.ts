import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";
import { withAccountBalances, type SavingsGoalDTO } from "./goals";
import { putInTrash } from "./trash.server";
import { accountBalance } from "./accounts";
import { listAccounts } from "./accounts.server";
import { listAccountTypes } from "./account-types.server";
import { listTransactions } from "./transactions.server";
import { listCategories } from "./categories.server";
import { listTransfers } from "./transfers.server";

interface SavingsGoalDoc {
  _id: ObjectId;
  userId: ObjectId;
  name: string;
  icon: string;
  targetAmount: number;
  /** 手動記錄模式才有意義；綁定帳戶的目標不會動這個欄位（進度來自帳戶餘額），但舊值
   *  留著不清掉——解除綁定之後就接回手動記錄，不用從零開始。 */
  currentAmount: number;
  /** 綁定的帳戶；沒有這個欄位＝手動記錄模式。 */
  accountId?: ObjectId;
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
    accountId: doc.accountId?.toHexString(),
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

/** listGoals 再把「綁定帳戶」那種目標的 currentAmount 換成帳戶的當下餘額。
 *
 *  **API 跟頁面都該用這一支**，不要直接用 listGoals：綁定模式的 currentAmount 在資料庫裡
 *  是一個過時的數字（手動記錄時代留下來的），直接回給前端的話，存檔之後進度條會跳回那個
 *  舊值，重新整理才變對。
 *
 *  代價是多讀四份資料（類型、交易、分類、轉帳）來算餘額。沒有綁定任何帳戶時整段跳過，
 *  所以只用手動記錄的人不會多付這個成本。 */
export async function listGoalsWithProgress(userId: ObjectId): Promise<SavingsGoalDTO[]> {
  const goals = await listGoals(userId);
  if (!goals.some((g) => g.accountId)) return goals;

  const [accounts, accountTypes, transactions, categories, transfers] = await Promise.all([
    listAccounts(userId),
    listAccountTypes(userId),
    listTransactions(userId),
    listCategories(userId),
    listTransfers(userId),
  ]);
  const balances = new Map(accounts.map((a) => [a.id, accountBalance(a, accountTypes, transactions, categories, transfers)]));
  return withAccountBalances(goals, balances);
}

export interface CreateGoalInput {
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  accountId?: string | null;
  startDate?: string;
  targetDate?: string;
}

export async function createGoal(
  userId: ObjectId,
  input: CreateGoalInput,
): Promise<{ goal: SavingsGoalDTO; goals: SavingsGoalDTO[] }> {
  const col = await collection();
  const { accountId, startDate, targetDate, ...rest } = input;
  const doc: SavingsGoalDoc = {
    _id: new ObjectId(),
    userId,
    ...rest,
    // 日期沒填就整個欄位不要寫（undefined 進 insertOne 會存成 null，之後讀回來是一個
    // 「有值但值是 null」的欄位，跟「沒設期限」不是同一件事）。
    ...(startDate ? { startDate } : {}),
    ...(targetDate ? { targetDate } : {}),
    // 沒綁定就整個欄位不要寫進去（而不是寫 null）——「沒有這個欄位」才是手動記錄模式的
    // 表示法，跟 toDTO 的 `doc.accountId?.toHexString()` 對齊。
    ...(accountId ? { accountId: new ObjectId(accountId) } : {}),
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  const goals = await listGoalsWithProgress(userId);
  return { goal: toDTO(doc), goals };
}

export interface UpdateGoalInput {
  name: string;
  icon: string;
  targetAmount: number;
  /** 手動記錄模式才會帶：使用者在編輯彈窗裡直接改「目前已存」的總額（存入的功能併進去
   *  了，見 goal-modal.tsx）。綁定帳戶時不帶，進度由餘額決定。 */
  currentAmount?: number;
  /** undefined＝這次不動綁定；null＝解除綁定改回手動記錄；字串＝綁到那個帳戶。 */
  accountId?: string | null;
  startDate?: string;
  targetDate?: string;
}

export async function updateGoal(userId: ObjectId, id: string, input: UpdateGoalInput): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  const { accountId, ...rest } = input;

  // **一定要濾掉 undefined**：MongoDB driver 預設會把 `{ currentAmount: undefined }` 寫成
  // `null`，不是「不要動這個欄位」。綁定帳戶的目標不送 currentAmount（進度來自餘額），
  // 結果資料庫裡那個欄位被寫成 null，之後解除綁定就變成「null ÷ 目標金額」——進度條算
  // 不出來，編輯彈窗的金額欄還會顯示 "null"。startDate／targetDate 留空時同理。
  const $set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) if (value !== undefined) $set[key] = value;
  if (accountId) $set.accountId = new ObjectId(accountId);

  await col.updateOne(
    { _id: new ObjectId(id), userId },
    {
      $set,
      // 日期清空要真的拿掉欄位，不是留一個 null；解除綁定也是（見 createGoal 的註解）。
      $unset: {
        ...(accountId === null ? { accountId: "" } : {}),
        ...(rest.startDate === undefined ? { startDate: "" } : {}),
        ...(rest.targetDate === undefined ? { targetDate: "" } : {}),
      },
    },
  );
  return listGoalsWithProgress(userId);
}

/** 存入：把金額加到目前已存金額——不另外留一份存入紀錄，只更新累計總額。
 *
 *  **綁定帳戶的目標會被跳過**：它的進度是那個帳戶的餘額算出來的，$inc 進去的數字根本
 *  不會被讀到，卻會在資料庫裡累積成一個誤導人的殘留值（之後解除綁定就會突然冒出來）。
 *  固定收支規則連動存錢目標時走的也是這一支（見 recurring-rules.server.ts），所以這裡
 *  擋掉就兩條路都擋掉了。 */
export async function contributeToGoal(userId: ObjectId, id: string, amount: number): Promise<SavingsGoalDTO[]> {
  const col = await collection();
  await col.updateOne({ _id: new ObjectId(id), userId, accountId: { $exists: false } }, { $inc: { currentAmount: amount } });
  return listGoalsWithProgress(userId);
}

/** 刪除目標前，先解除所有連著它的固定收支規則（linkedGoalId 設回空）——不然規則還留著
 *  一個指向已刪除目標的 id，之後每次自動入帳都會對一個不存在的目標做 $inc，靜默什麼事
 *  都不會發生，使用者永遠不會發現連動早就失效了（見 recurring-rules.server.ts 的
 *  confirmOneOccurrence）。規則本身不用跟著刪，只是不再連動存錢目標。 */
export async function deleteGoal(userId: ObjectId, id: string): Promise<{ goals: SavingsGoalDTO[]; trashId?: string }> {
  const db = await getDb();
  const goalId = new ObjectId(id);
  const col = await collection();
  const doc = await col.findOne({ _id: goalId, userId });
  if (!doc) return { goals: await listGoalsWithProgress(userId) };

  // 解除固定收支對它的連動。這個副作用刻意**不**記進垃圾桶：還原目標之後要不要重新
  // 連動是使用者的決定，自作主張接回去反而會讓一條他已經改過的規則突然又開始存錢。
  await db.collection("expenses.recurringRules").updateMany({ userId, linkedGoalId: goalId }, { $unset: { linkedGoalId: "" } });

  const trashId = await putInTrash(userId, {
    kind: "goal",
    label: doc.name,
    sublabel: `目標 ${doc.targetAmount}`,
    icon: doc.icon,
    entries: [{ collection: "expenses.goals", doc }],
  });
  await col.deleteOne({ _id: goalId, userId });
  return { goals: await listGoalsWithProgress(userId), trashId };
}
