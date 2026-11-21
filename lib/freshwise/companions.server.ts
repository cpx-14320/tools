// 夥伴養成的伺服器端儲存。**狀態跟著帳號走，不是跟著瀏覽器走。**
//
// 本來整份進度存在 localStorage，於是換一台裝置、換一個瀏覽器、清一次瀏覽資料，等級跟
// 露珠就全部不見；而且同一台電腦上換帳號登入會看到別人的夥伴。改成一個使用者一份文件
// （`freshwise.companions`，`_id` 就是使用者的 ObjectId 字串）。
//
// 變更一律在伺服器端套用 companions.ts 的那幾個純函式，前端送的是「發生了什麼事」而不是
// 「新的狀態長這樣」——不然在瀏覽器把 dew 改成 9999 再送上來就直接寫進資料庫了。
// 同一組純函式前端也會跑一次做樂觀更新，兩邊算出來的結果一樣，回應到了再以伺服器為準。

import type { Collection } from "mongodb";
import { getDb } from "../mongodb";
import {
  careForCompanion,
  claimCompanionQuest,
  companionDay,
  dailyState,
  initialCompanionState,
  parseCompanionState,
  recordCompanionEvent,
  selectCompanion,
  type CompanionEvent,
  type CompanionId,
  type CompanionState,
  type QuestId,
} from "./companions";

interface CompanionDoc {
  _id: string;
  state: CompanionState;
  updatedAt: Date;
}

async function companions(): Promise<Collection<CompanionDoc>> {
  return (await getDb()).collection<CompanionDoc>("freshwise.companions");
}

/** 讀出這個使用者的進度，順便做跨日重置（每天的任務要重來，但等級與露珠不會歸零）。
 *  沒有文件代表第一次用，給一份初始狀態但先不寫進資料庫——只是開個頁面看看行情的人
 *  不需要在資料庫留一筆。 */
export async function loadCompanion(userId: string, day = companionDay()): Promise<CompanionState> {
  const doc = await (await companions()).findOne({ _id: userId });
  if (!doc) return initialCompanionState(day);
  // 走跟 localStorage 同一個解析器：欄位缺漏、版本不對、被手動改壞都會退回安全值。
  return parseCompanionState(JSON.stringify(doc.state), day);
}

async function save(userId: string, state: CompanionState): Promise<CompanionState> {
  await (await companions()).updateOne({ _id: userId }, { $set: { state, updatedAt: new Date() } }, { upsert: true });
  return state;
}

export type CompanionAction =
  | { kind: "events"; events: CompanionEvent[] }
  | { kind: "claim"; quest: QuestId }
  | { kind: "care"; action: "water" | "play" }
  | { kind: "select"; id: CompanionId }
  | { kind: "reset" };

/**
 * 套用一個動作並寫回。回傳套用後的狀態給前端對帳。
 *
 * 讀了再寫中間沒有鎖——這是單一使用者自己的進度，兩個分頁同時操作最壞的情況是後寫的
 * 蓋掉前一個，不會算錯別人的帳，為此上鎖不划算。
 */
export async function applyCompanionAction(userId: string, action: CompanionAction, day = companionDay()): Promise<CompanionState> {
  const current = await loadCompanion(userId, day);
  switch (action.kind) {
    case "events": {
      // 一次收一批（前端把短時間內的瀏覽事件攢起來再送），逐一套用。
      let next = current;
      for (const event of action.events.slice(0, 50)) next = recordCompanionEvent(next, event, day);
      return next === current ? current : save(userId, next);
    }
    case "claim": {
      const next = claimCompanionQuest(current, action.quest, day);
      return next === current ? current : save(userId, next);
    }
    case "care": {
      const next = careForCompanion(current, action.action, day);
      return next === current ? current : save(userId, next);
    }
    case "select": {
      const next = selectCompanion(current, action.id);
      return next === current ? current : save(userId, next);
    }
    case "reset":
      return save(userId, initialCompanionState(day));
  }
}

/** 設定頁的「清除全部資料」用。 */
export async function deleteCompanion(userId: string): Promise<void> {
  await (await companions()).deleteOne({ _id: userId });
}

/** 從這台裝置的 localStorage 搬上來（只在雲端還沒有任何進度時才接受，不然換裝置登入
 *  會被那台裝置的舊進度蓋掉）。回傳最後採用的狀態。 */
export async function migrateCompanionFromDevice(userId: string, raw: string, day = companionDay()): Promise<CompanionState> {
  const existing = await (await companions()).findOne({ _id: userId });
  if (existing) return parseCompanionState(JSON.stringify(existing.state), day);
  const incoming = dailyState(parseCompanionState(raw, day), day);
  return save(userId, incoming);
}
