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
 *  **預設開啟**（2026-11-16 改）：AI 記帳是新用戶最先會想試的功能之一，預設關掉等於
 *  要先懂「設定裡有一個開關」才摸得到入口，多數人根本不會去找。不想用的人自己到設定頁
 *  關掉即可，跟其他預設資料一樣是「先給看得到，再讓人自己收起來」而不是反過來。
 *  沒設過值的（doc 不存在、或資料庫裡是舊帳號留下的 undefined）一律當作開啟——只有
 *  明確存過 `false` 的才是真的關掉。 */
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
  return { aiEnabled: doc?.aiEnabled !== false };
}

export async function setExpensesSettings(userId: ObjectId, patch: Partial<ExpensesSettings>): Promise<ExpensesSettings> {
  const col = await collection();
  await col.updateOne({ userId }, { $set: patch, $setOnInsert: { userId } }, { upsert: true });
  return getExpensesSettings(userId);
}
