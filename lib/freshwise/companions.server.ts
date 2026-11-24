// 夥伴進度跟著帳號走；版本比對避免同時澆水、領獎或兌換時互相覆蓋。
import type { Collection } from "mongodb";
import { getDb } from "../mongodb";
import {
  careForCompanion, claimCompanionQuest, companionDay, dailyState, initialCompanionState,
  parseCompanionState, recordCompanionEvent, selectCompanion,
  type CompanionEvent, type CompanionId, type CompanionState, type QuestId,
} from "./companions";

interface CompanionDoc {
  _id: string;
  state: CompanionState;
  updatedAt: Date;
  revision?: number;
}

async function companions(): Promise<Collection<CompanionDoc>> {
  return (await getDb()).collection<CompanionDoc>("freshwise.companions");
}

export async function loadCompanion(userId: string, day = companionDay()): Promise<CompanionState> {
  const doc = await (await companions()).findOne({ _id: userId });
  return doc ? parseCompanionState(JSON.stringify(doc.state), day) : initialCompanionState(day);
}

type CompanionChange = { state: CompanionState };

/** 既有文件可能沒有 revision；第一次寫入時一併補上。衝突時重新讀取並重算。 */
async function mutateCompanion(userId: string, day: string, change: (state: CompanionState, doc: CompanionDoc | null) => CompanionChange): Promise<CompanionState> {
  const collection = await companions();
  for (let attempt = 0; attempt < 32; attempt++) {
    const doc = await collection.findOne({ _id: userId });
    const current = doc ? parseCompanionState(JSON.stringify(doc.state), day) : initialCompanionState(day);
    const next = change(current, doc);
    if (next.state === current) return current;
    if (!doc) {
      try {
        await collection.insertOne({ _id: userId, state: next.state, revision: 1, updatedAt: new Date() });
        return next.state;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) continue;
        throw error;
      }
    }
    const result = await collection.updateOne(
      { _id: userId, revision: doc.revision ?? { $exists: false } },
      { $set: { state: next.state, updatedAt: new Date() }, $inc: { revision: 1 } },
    );
    if (result.matchedCount === 1) return next.state;
  }
  throw new Error("夥伴資料正在更新，請稍後再試。");
}

export type CompanionAction =
  | { kind: "events"; events: CompanionEvent[] }
  | { kind: "claim"; quest: QuestId }
  | { kind: "care"; action: "water" | "play" }
  | { kind: "select"; id: CompanionId }
  | { kind: "reset" };

export async function applyCompanionAction(userId: string, action: CompanionAction, day = companionDay()): Promise<CompanionState> {
  return mutateCompanion(userId, day, (current) => {
    switch (action.kind) {
      case "events": {
        let next = current;
        for (const event of action.events.slice(0, 50)) next = recordCompanionEvent(next, event, day);
        return { state: next };
      }
      case "claim": return { state: claimCompanionQuest(current, action.quest, day) };
      case "care": return { state: careForCompanion(current, action.action, day) };
      case "select": return { state: selectCompanion(current, action.id) };
      case "reset": return { state: initialCompanionState(day) };
    }
  });
}

export class CompanionCodeError extends Error {
  constructor() {
    super("找不到這組活動序號，請再確認看看。");
    this.name = "CompanionCodeError";
  }
}

/** 每次有效兌換都增加獎勵；序號與露珠數量由伺服器核對。 */
export async function redeemCompanionCode(userId: string, value: unknown, day = companionDay()): Promise<{ state: CompanionState; reward: number }> {
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (code !== "cpx1104") throw new CompanionCodeError();
  const reward = 1000;
  const state = await mutateCompanion(userId, day, (current) => ({ state: { ...current, dew: current.dew + reward } }));
  return { state, reward };
}

/** 重設養成進度。 */
export async function deleteCompanion(userId: string): Promise<void> {
  await applyCompanionAction(userId, { kind: "reset" });
}

/** 只在帳號完全沒有進度時接受裝置搬家；與領獎、重設共用版本檢查。 */
export async function migrateCompanionFromDevice(userId: string, raw: string, day = companionDay()): Promise<CompanionState> {
  return mutateCompanion(userId, day, (current, doc) => ({ state: doc ? current : dailyState(parseCompanionState(raw, day), day) }));
}
