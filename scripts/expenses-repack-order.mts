/** 把分類／帳戶類型的 order 重新編成 0,1,2,…，保持目前看到的順序不變。
 *
 *  **為什麼需要**：以前新增時 order 是用「目前有幾筆」算的，刪過東西之後序列就有洞
 *  （0,1,2,4,5…），新的那筆拿到的數字會跟既有的撞在一起，排序並列、位置不穩定
 *  （見 categories.server.ts 的 nextOrder）。新增邏輯已經改成「最大值＋1」，但已經
 *  撞在一起的舊資料要手動收拾一次。
 *
 *  只動 order 欄位，不新增也不刪除任何文件。
 *
 *  用法：
 *    npx tsx scripts/expenses-repack-order.mts            # 只看會怎麼編（預設）
 *    npx tsx scripts/expenses-repack-order.mts --apply    # 真的寫入
 */
import { MongoClient, ObjectId } from "mongodb";
import { readFileSync, writeFileSync } from "node:fs";

const apply = process.argv.includes("--apply");

const env = readFileSync(".env.local", "utf8");
const matched = /^MONGODB_URI=(.*)$/m.exec(env);
const uri = (matched ? matched[1] : "").trim().replace(/^["']|["']$/g, "");
if (!uri) throw new Error("在 .env.local 找不到 MONGODB_URI");

const client = new MongoClient(uri);
await client.connect();
const db = client.db("Tools");

const lines: string[] = [];
const log = (s: string) => lines.push(s);

/** 同一組（同一個使用者、同一個 kind、同一個父層）重新編號。
 *  排序鍵用 order 再用 _id：order 撞在一起時，靠 _id（建立時間遞增）決定誰在前面，
 *  跟目前畫面上看到的順序一致。 */
async function repack(coll: string, groupKeys: string[]) {
  const docs = await db.collection(coll).find({}).toArray();
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const d of docs) {
    const key = groupKeys.map((k) => String(d[k] ?? "")).join("|");
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  let changed = 0;
  for (const [key, group] of groups) {
    const sorted = group
      .slice()
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0) || String(a._id).localeCompare(String(b._id)));
    const before = sorted.map((d) => `${String(d.order)}:${String(d.name)}`).join(" ");
    const moves: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (Number(sorted[i].order) === i) continue;
      moves.push(`${String(sorted[i].name)} ${String(sorted[i].order)}→${i}`);
      changed += 1;
      if (apply) await db.collection(coll).updateOne({ _id: sorted[i]._id as ObjectId }, { $set: { order: i } });
    }
    if (moves.length > 0) {
      log(`${coll} [${key}]`);
      log(`  原本：${before}`);
      log(`  調整：${moves.join("、")}`);
    }
  }
  log(`${coll}：共調整 ${changed} 筆\n`);
}

await repack("expenses.categories", ["userId", "kind", "parentId"]);
await repack("expenses.accountTypes", ["userId", "kind"]);

log(apply ? "已執行（--apply）。" : "這是試跑，沒有寫入。要真的改請加 --apply。");
await client.close();
writeFileSync("scripts/.repack-report.txt", lines.join("\n"), "utf8");
console.log("report written");
