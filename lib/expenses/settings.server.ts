import { ObjectId } from "mongodb";
import { getDb } from "../mongodb";

/** 記帳本的使用者偏好——目前只有「要不要顯示 AI 記帳的入口」。
 *
 *  **為什麼存在資料庫而不是 localStorage**：記帳本的頁面全部是 Server Component，
 *  localStorage 伺服器讀不到。開關存在瀏覽器的話，入口會變成「伺服器先畫出來、瀏覽器
 *  接手之後才消失」，每次進首頁都閃一下。存在資料庫，伺服器當場就知道要不要畫。
 *
 *  **跟 API 金鑰分開存是刻意的**：開關只是偏好，跨裝置一致才合理；金鑰是憑證，只留在
 *  使用者自己的瀏覽器、我們不保管（見 components/expenses/ai/use-ai-key.ts）。兩者的
 *  性質不同，不該因為「都跟 AI 有關」就放在一起。
 *
 *  預設關閉：AI 是附屬功能，主要操作還是手動記帳。沒開的人版面上完全看不到它。 */
interface ExpensesSettingsDoc {
  _id: ObjectId;
  userId: ObjectId;
  aiEnabled?: boolean;
}

function collection() {
  return getDb().then((db) => db.collection<ExpensesSettingsDoc>("expenses.settings"));
}

export interface ExpensesSettings {
  aiEnabled: boolean;
}

export async function getExpensesSettings(userId: ObjectId): Promise<ExpensesSettings> {
  const col = await collection();
  const doc = await col.findOne({ userId });
  return { aiEnabled: doc?.aiEnabled === true };
}

export async function setExpensesSettings(userId: ObjectId, patch: Partial<ExpensesSettings>): Promise<ExpensesSettings> {
  const col = await collection();
  await col.updateOne({ userId }, { $set: patch, $setOnInsert: { userId } }, { upsert: true });
  return getExpensesSettings(userId);
}
