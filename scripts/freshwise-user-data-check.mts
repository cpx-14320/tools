/** 新用戶範本與清空後保留空菜籃的回歸檢查；以記憶體集合替代 MongoDB。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as basket from "../lib/freshwise/basket";
import * as prefs from "../lib/freshwise/prefs";
import { findItem } from "../lib/freshwise/catalog";

type StoredDoc = { _id: string; prefs?: unknown; basket?: unknown; updatedAt?: Date };
const docs = new Map<string, StoredDoc>();
let deleteCalls = 0;
const collection = {
  async findOne(filter: { _id: string }) {
    return structuredClone(docs.get(filter._id) ?? null);
  },
  async updateOne(filter: { _id: string }, update: { $set: Partial<StoredDoc> }, options?: { upsert?: boolean }) {
    const current = docs.get(filter._id);
    if (!current && !options?.upsert) return { matchedCount: 0 };
    docs.set(filter._id, { ...current, _id: filter._id, ...structuredClone(update.$set) });
    return { matchedCount: current ? 1 : 0 };
  },
  async deleteOne(filter: { _id: string }) {
    deleteCalls++;
    docs.delete(filter._id);
  },
};
const compiled = ts.transpileModule(readFileSync(new URL("../lib/freshwise/user-data.server.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const serverModule = { exports: {} };
new Function("require", "module", "exports", compiled)((name: string) => {
  if (name === "../mongodb") return { getDb: async () => ({ collection: (collectionName: string) => { assert.equal(collectionName, "freshwise.userData"); return collection; } }) };
  if (name === "./basket") return basket;
  if (name === "./prefs") return prefs;
  throw new Error(`Unexpected runtime dependency: ${name}`);
}, serverModule, serverModule.exports);
const server = serverModule.exports as typeof import("../lib/freshwise/user-data.server");

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed++;
  console.log(`✓ ${name}`);
}

await check("預設採用目前四道料理、11項食材，保留圖示、順序、份量與空份量", () => {
  const value = basket.defaultBasket();
  assert.deepEqual(value.groups.map(g => [g.name, g.icon, g.order]), [
    ["鳳梨蝦球", "dish-pineapple-shrimp", 0],
    ["炒三鮮", "dish-mixed-seafood-stir-fry", 1],
    ["海鮮粥", "dish-seafood-congee", 2],
    ["蚵仔煎", "dish-oyster-omelet", 3],
  ]);
  const actual = value.groups.map(group => basket.entriesOfGroup(value, group.id).map(entry => [entry.code, entry.qtyCatty]));
  assert.deepEqual(actual, [
    [["GA2", 1], ["HB3", 1]],
    [["HB7", 0.5], ["HB5", 0.5], ["HB4", 0.5], ["HB3", 0.5]],
    [["HB4", null], ["HB3", null], ["RA1", null]],
    [["HB5", 1], ["EA1", 1]],
  ]);
  assert.equal(value.entries.length, 11);
  for (const entry of value.entries) assert.ok(findItem(entry.code), entry.code);
});

await check("不同使用者取得獨立菜籃，固定id且修改一份不污染範本", () => {
  const first = basket.defaultBasket(), second = basket.defaultBasket();
  assert.deepEqual(first, second);
  first.groups[0].name = "自行修改";
  first.entries[0].qtyCatty = 9;
  assert.equal(second.groups[0].name, "鳳梨蝦球");
  assert.equal(basket.defaultBasket().entries[0].qtyCatty, 1);
});

await check("首次使用有內容，已有偏好但尚未建立菜籃也有預設內容", async () => {
  const first = await server.loadUserData("new-user");
  assert.deepEqual(first.basket, basket.defaultBasket());
  assert.equal(first.fresh, true);
  docs.set("prefs-only", { _id: "prefs-only", prefs: { ...prefs.DEFAULT_PREFS, unit: "kg" } });
  const existingPrefs = await server.loadUserData("prefs-only");
  assert.deepEqual(existingPrefs.basket, basket.defaultBasket());
  assert.equal(existingPrefs.prefs.unit, "kg");
});

await check("既有使用者的自訂菜籃不會被新範本覆蓋", async () => {
  let custom = basket.addGroup(basket.emptyBasket(), "自己的菜單", "basket-shopping");
  custom = basket.addEntry(custom, custom.groups[0].id, "FA1", 2);
  await server.saveBasket("owner", custom);
  assert.deepEqual((await server.loadUserData("owner")).basket, custom);
});

await check("手動刪光分類並儲存，重新載入仍是空菜籃", async () => {
  let value = basket.defaultBasket();
  for (const group of value.groups) value = basket.deleteGroup(value, group.id);
  await server.saveBasket("manual-clear", value);
  for (let i = 0; i < 2; i++) {
    const loaded = await server.loadUserData("manual-clear");
    assert.deepEqual(loaded.basket, basket.emptyBasket());
    assert.equal(loaded.fresh, false);
  }
});

await check("設定頁儲存空菜籃後不補回，更新偏好也不會帶回預設料理", async () => {
  await server.saveBasket("settings-clear", basket.emptyBasket());
  await server.savePrefs("settings-clear", { ...prefs.DEFAULT_PREFS, unit: "kg" });
  const loaded = await server.loadUserData("settings-clear");
  assert.deepEqual(loaded.basket, basket.emptyBasket());
  assert.equal(loaded.prefs.unit, "kg");
  assert.equal(loaded.fresh, false);
});

await check("清除API保留空菜籃紀錄，不會被當成新用戶，也不影響其他帳號", async () => {
  const other = await server.loadUserData("owner");
  await server.saveBasket("api-clear", basket.defaultBasket());
  await server.savePrefs("api-clear", { ...prefs.DEFAULT_PREFS, unit: "kg" });
  await server.clearUserData("api-clear");
  assert.ok(docs.has("api-clear"));
  const loaded = await server.loadUserData("api-clear");
  assert.deepEqual(loaded.basket, basket.emptyBasket());
  assert.deepEqual(loaded.prefs, prefs.DEFAULT_PREFS);
  assert.equal(loaded.fresh, false);
  assert.equal(deleteCalls, 0);
  assert.deepEqual(await server.loadUserData("owner"), other);
});

await check("尚未建立資料的帳號主動清除後，也不會補回範本", async () => {
  await server.clearUserData("clear-before-save");
  const loaded = await server.loadUserData("clear-before-save");
  assert.deepEqual(loaded.basket, basket.emptyBasket());
  assert.equal(loaded.fresh, false);
});

await check("已存成null的舊菜籃不會被誤認為從未使用", async () => {
  docs.set("legacy-empty", { _id: "legacy-empty", basket: null });
  assert.deepEqual((await server.loadUserData("legacy-empty")).basket, basket.emptyBasket());
});

await check("清空後主動新增項目，只建立自己的分類，不整份還原", async () => {
  const value = basket.toggleBasket((await server.loadUserData("manual-clear")).basket, "FA1");
  await server.saveBasket("manual-clear", value);
  const loaded = await server.loadUserData("manual-clear");
  assert.equal(loaded.basket.groups.length, 1);
  assert.deepEqual(loaded.basket.entries.map(entry => entry.code), ["FA1"]);
});

console.log(`\nFreshWise 新用戶菜籃與清空流程 ${passed} 組檢查通過。`);

