import { MongoClient, type Db } from "mongodb";

const DB_NAME = "Tools";

declare global {
  // 開發模式下 Next.js 熱重載會重新執行這個模組，用 global 快取連線，
  // 不然每次重載都會開一條新的 MongoDB 連線，很快就把連線數用滿。
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("缺少 MONGODB_URI 環境變數");
  return new MongoClient(uri).connect();
}

const clientPromise = globalThis._mongoClientPromise ?? createClientPromise();
if (process.env.NODE_ENV !== "production") {
  globalThis._mongoClientPromise = clientPromise;
}

let indexesReady: Promise<void> | null = null;

// 這幾個 index 只要存在就會被當成已經建立（createIndex 是 idempotent 操作），
// 所以每次拿 db 都呼叫一次也沒關係，不會重複建立或壞資料。
async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("toolsRegistry").createIndex({ toolId: 1 }, { unique: true }),
  ]);

  // toolsRegistry 是目前工具清單的真實來源，用 upsert 寫入已知的兩個工具，
  // 之後首頁要依使用者權限動態列出工具時就是讀這個集合。
  const tools = [
    { toolId: "expenses", name: "記帳本", description: "計算每月薪水、記錄各類消費，可多人共用一個帳本。", icon: "📒", href: "/tools/expenses" },
    { toolId: "transit", name: "搭乘車查詢", description: "查固定通勤班次時刻表，誤點或即將到站時推播提醒。", icon: "🚌", href: "/tools/transit" },
  ];
  await Promise.all(
    tools.map((t) => db.collection("toolsRegistry").updateOne({ toolId: t.toolId }, { $set: t }, { upsert: true })),
  );
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  indexesReady ??= ensureIndexes(db);
  await indexesReady;
  return db;
}
