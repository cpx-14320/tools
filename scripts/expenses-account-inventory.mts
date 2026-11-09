/** 唯讀盤點：每個使用者帳號底下有多少記帳資料。
 *
 *  刪帳號之前先看清楚要刪掉什麼——帳號 id 看起來都一樣，光靠 id 決定「這個可以刪」太
 *  容易刪錯。密碼相關欄位一律不讀。
 *
 *  用法：npx tsx scripts/expenses-account-inventory.mts
 */
import { MongoClient, ObjectId } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const uri = /^MONGODB_URI=(.*)$/m
  .exec(env)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
if (!uri) throw new Error("在 .env.local 找不到 MONGODB_URI");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("Tools");

const lines: string[] = [];
const log = (s: string) => lines.push(s);

// 只讀帳號識別資訊，不讀 password / passwordHash 之類的欄位。
const users = await db
  .collection("users")
  .find({}, { projection: { username: 1, name: 1, createdAt: 1 } })
  .toArray();

const COLLECTIONS = [
  "expenses.meta",
  "expenses.categories",
  "expenses.transactions",
  "expenses.transfers",
  "expenses.accounts",
  "expenses.accountTypes",
  "expenses.recurringRules",
  "expenses.goals",
  "expenses.budgets",
  "expenses.trash",
  "expenses.pet",
  "transit.memos",
  "transit.frequentTrips",
  "transit.tripGroups",
];

log(`users 共 ${users.length} 筆\n`);
for (const u of users) {
  const userId = u._id as ObjectId;
  log(`── ${String(u.username ?? "(無 username)")}  id=${userId.toHexString()}`);
  log(`   name=${String(u.name ?? "")}  createdAt=${u.createdAt ? new Date(u.createdAt as Date).toISOString().slice(0, 10) : "?"}`);
  const parts: string[] = [];
  for (const coll of COLLECTIONS) {
    const n = await db.collection(coll).countDocuments({ userId });
    if (n > 0) parts.push(`${coll.replace(/^expenses\./, "")}=${n}`);
  }
  log(`   ${parts.length > 0 ? parts.join("  ") : "（沒有任何資料）"}`);
  log("");
}

// 有資料但在 users 裡找不到對應帳號的 userId（孤兒資料）。
const knownIds = new Set(users.map((u) => String(u._id)));
const orphan = new Map<string, string[]>();
for (const coll of COLLECTIONS) {
  for (const id of await db.collection(coll).distinct("userId")) {
    if (knownIds.has(String(id))) continue;
    orphan.set(String(id), [...(orphan.get(String(id)) ?? []), coll]);
  }
}
if (orphan.size > 0) {
  log("── 孤兒資料（userId 在 users 裡查不到，帳號已被刪掉但資料還在）");
  for (const [id, colls] of orphan) log(`   ${id}: ${colls.join("、")}`);
} else {
  log("── 沒有孤兒資料");
}

await client.close();
writeFileSync("scripts/.inventory.txt", lines.join("\n"), "utf8");
console.log("report written");
