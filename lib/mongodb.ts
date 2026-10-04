import { MongoClient, type Db } from "mongodb";
import { TOOLS_REGISTRY } from "./tools-registry";

const DB_NAME = "Tools";

declare global {
  // 開發模式下 Next.js 熱重載會重新執行這個模組，用 global 快取連線，不然每次重載都會開
  // 一條新的 MongoDB 連線，很快就把連線數用滿；正式環境（Vercel serverless）裡同一個還
  // 熱著的 function instance 處理下一個請求時也能重複用這條連線，不用每次都重新連。
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("缺少 MONGODB_URI 環境變數");
  return new MongoClient(uri).connect();
}

// 故意不在模組頂層就建立連線——Next.js build 階段（`next build`）會匯入、分析這個模組
// 所在的 import chain（route handler／layout），如果這裡在頂層就急著連線，build 環境
// 沒有 MONGODB_URI 時會直接整個 build 失敗。改成只有第一次真的呼叫 getDb() 才連線。
function getClientPromise(): Promise<MongoClient> {
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createClientPromise();
  }
  return globalThis._mongoClientPromise;
}

let indexesReady: Promise<void> | null = null;

// 這幾個 index 只要存在就會被當成已經建立（createIndex 是 idempotent 操作），
// 所以每次拿 db 都呼叫一次也沒關係，不會重複建立或壞資料。
async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("toolsRegistry").createIndex({ toolId: 1 }, { unique: true }),
    db.collection("transit.memos").createIndex({ userId: 1, order: 1 }),
    db.collection("transit.frequentTrips").createIndex({ userId: 1, mode: 1, groupId: 1, order: 1 }),
    db.collection("transit.tripGroups").createIndex({ userId: 1, mode: 1, order: 1 }),
  ]);

  // toolsRegistry 是目前工具清單的真實來源，用 upsert 寫入 lib/tools-registry.ts 裡
  // 已知的工具，之後首頁要依使用者權限動態列出工具時就是讀這個集合。
  await Promise.all(
    TOOLS_REGISTRY.map((t) => db.collection("toolsRegistry").updateOne({ toolId: t.toolId }, { $set: t }, { upsert: true })),
  );
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  indexesReady ??= ensureIndexes(db);
  await indexesReady;
  return db;
}
