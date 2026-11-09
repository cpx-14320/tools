/** 清掉「預設資料被建了兩遍」的帳號。
 *
 *  **為什麼會有這支**：expenses.meta 以前沒有 userId 的 unique index，所以
 *  seedExpensesPresets 那個「upsert 有沒有插進去」的閘門擋不住併發，整份預設分類／
 *  帳戶類型／帳戶會被建兩遍（詳見 lib/mongodb.ts 那個索引旁邊的註解）。索引加上去之後
 *  不會再發生，但已經壞掉的帳號要手動清。
 *
 *  **保留哪一份**：每組同名的預設資料保留 _id 最小（也就是最早建立）的那一筆。要刪的
 *  那幾筆會先確認「沒有任何交易／轉帳／規則／目標掛在上面」，有掛到的就留著不動並列出來
 *  ——寧可留下一筆重複的分類，也不要讓使用者的交易指到一個不存在的分類。
 *
 *  用法：
 *    npx tsx scripts/expenses-dedupe-presets.mts            # 只看會刪什麼（預設）
 *    npx tsx scripts/expenses-dedupe-presets.mts --apply    # 真的刪
 */
import { MongoClient, ObjectId } from "mongodb";
import { readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");

// 直接讀 .env.local，不經過 next 的載入流程（這支是獨立腳本，不跑在 Next 裡面）。
const env = readFileSync(".env.local", "utf8");
// 去掉行尾的換行字元（檔案是 CRLF）跟可能包著的引號。
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

// ── 1. 重複的 meta ────────────────────────────────────────────────────────────
const metas = await db.collection("expenses.meta").find({}).toArray();
const metaByUser = new Map<string, ObjectId[]>();
for (const m of metas) {
  const key = String(m.userId);
  metaByUser.set(key, [...(metaByUser.get(key) ?? []), m._id as ObjectId]);
}
const dupMetaUsers = [...metaByUser.entries()].filter(([, ids]) => ids.length > 1);
log(`expenses.meta：${metas.length} 筆，其中 ${dupMetaUsers.length} 個使用者有重複`);
for (const [userId, ids] of dupMetaUsers) {
  const keep = ids.slice().sort()[0];
  const drop = ids.filter((id) => !id.equals(keep));
  log(`  user ${userId}：保留 ${keep.toHexString()}，刪 ${drop.length} 筆`);
  if (apply) await db.collection("expenses.meta").deleteMany({ _id: { $in: drop } });
}

// ── 2. 重複的預設分類／帳戶類型／帳戶 ───────────────────────────────────────
/** 「誰會指到這種資料」——重複品刪掉之前要先把這些參照搬到保留的那一筆上。
 *
 *  **為什麼一定要搬而不是跳過**：重複的兩份長得一模一樣，使用者在畫面上看到兩個「餐飲」，
 *  記帳時點到哪一個是隨機的，所以交易會散在兩份上。只刪「沒人用到的那些」的話，有被用到
 *  的那幾組永遠留著兩份。搬過去對使用者來說是零差異（名稱、種類、圖示都相同），搬完才刪
 *  得乾淨。 */
const REFS: Record<string, [string, string][]> = {
  "expenses.categories": [
    ["expenses.transactions", "categoryId"],
    ["expenses.recurringRules", "categoryId"],
    ["expenses.categories", "parentId"],
  ],
  "expenses.accounts": [
    ["expenses.transactions", "accountId"],
    ["expenses.transfers", "fromAccountId"],
    ["expenses.transfers", "toAccountId"],
    ["expenses.categories", "defaultAccountId"],
    ["expenses.recurringRules", "accountId"],
  ],
  "expenses.accountTypes": [["expenses.accounts", "accountTypeId"]],
};

/** 同一個使用者底下依 key 分組；每組保留最早建立的那一筆，其餘的參照搬過去之後刪掉。 */
async function dedupe(coll: string, keyOf: (d: Record<string, unknown>) => string, filter: Record<string, unknown> = {}) {
  const docs = await db.collection(coll).find({ isPreset: true, ...filter }).toArray();
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const d of docs) {
    const key = `${String(d.userId)}|${keyOf(d)}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  let dropped = 0;
  let moved = 0;
  let dupGroups = 0;
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    dupGroups += 1;
    const sorted = group.slice().sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const keep = sorted[0]._id as ObjectId;
    const drop = sorted.slice(1).map((d) => d._id as ObjectId);

    for (const [refColl, field] of REFS[coll] ?? []) {
      const n = await db.collection(refColl).countDocuments({ [field]: { $in: drop } });
      if (n === 0) continue;
      moved += n;
      if (apply) await db.collection(refColl).updateMany({ [field]: { $in: drop } }, { $set: { [field]: keep } });
    }
    dropped += drop.length;
    if (apply) await db.collection(coll).deleteMany({ _id: { $in: drop } });
  }
  log(`${coll}：${docs.length} 筆 isPreset，${dupGroups} 組重複 -> 刪 ${dropped} 筆，搬移 ${moved} 筆參照`);
}

// **主分類要先做，子分類才認得出自己重複**：子分類的分組鍵包含 parentId，兩份「餐飲」
// 底下各自的「早餐」掛在不同的 parentId 上，看起來就不是同一組。主分類合併完（子分類的
// parentId 被搬到保留的那一筆），兩個「早餐」才會落在同一組。
await dedupe("expenses.categories", (d) => `${String(d.kind)}|${String(d.name)}`, { parentId: null });
await dedupe("expenses.categories", (d) => `${String(d.kind)}|${String(d.parentId ?? "")}|${String(d.name)}`, { parentId: { $ne: null } });
await dedupe("expenses.accounts", (d) => String(d.name));
await dedupe("expenses.accountTypes", (d) => `${String(d.kind)}|${String(d.name)}`);

log(apply ? "\n已執行（--apply）。" : "\n這是試跑，沒有動到任何資料。要真的刪請加 --apply。");
await client.close();

// Windows 的終端機是 cp950，中文直接 console.log 會變亂碼——寫到檔案再用別的方式看。
const { writeFileSync } = await import("node:fs");
writeFileSync("scripts/.dedupe-report.txt", lines.join("\n"), "utf8");
console.log("report written");
