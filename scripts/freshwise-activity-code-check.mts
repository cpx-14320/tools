/** 活動序號與重設進度的回歸檢查，使用記憶體集合，不連線、不更動任何帳號。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as companions from "../lib/freshwise/companions";
import * as basket from "../lib/freshwise/basket";
import * as prefs from "../lib/freshwise/prefs";

type Doc = { _id: string; state?: companions.CompanionState; revision?: number; redeemedCodes?: string[]; [key: string]: unknown };
const documents = new Map<string, Map<string, Doc>>();
function collection(name: string) {
  let docs = documents.get(name);
  if (!docs) { docs = new Map(); documents.set(name, docs); }
  const values = docs;
  return {
    async findOne(filter: { _id: string }) { return structuredClone(values.get(filter._id) ?? null); },
    async insertOne(doc: Doc) {
      if (values.has(doc._id)) throw Object.assign(new Error("Duplicate _id"), { code: 11000 });
      values.set(doc._id, structuredClone(doc));
      return { insertedId: doc._id };
    },
    async updateOne(filter: { _id: string; revision?: number | { $exists: boolean } }, update: { $set: Partial<Doc>; $inc?: { revision?: number } }, options?: { upsert?: boolean }) {
      const doc = values.get(filter._id);
      if (!doc && !options?.upsert) return { matchedCount: 0 };
      if (filter.revision !== undefined) {
        if (!doc) return { matchedCount: 0 };
        if (typeof filter.revision === "number" ? doc.revision !== filter.revision : (doc.revision !== undefined) !== filter.revision.$exists) return { matchedCount: 0 };
      }
      const next = { ...doc, _id: filter._id, ...structuredClone(update.$set) };
      if (update.$inc?.revision) next.revision = (doc?.revision ?? 0) + update.$inc.revision;
      values.set(filter._id, next);
      return { matchedCount: doc ? 1 : 0 };
    },
  };
}
function loadServer<T>(relative: string, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const serverModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name: string) => {
    if (name === "../mongodb") return { getDb: async () => ({ collection }) };
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, serverModule, serverModule.exports);
  return serverModule.exports as T;
}
const server = loadServer<typeof import("../lib/freshwise/companions.server")>("../lib/freshwise/companions.server.ts", { "./companions": companions });
const userData = loadServer<typeof import("../lib/freshwise/user-data.server")>("../lib/freshwise/user-data.server.ts", { "./basket": basket, "./prefs": prefs });
const day = "2026-11-24";
let passed = 0;
async function check(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`); }

await check("錯誤、空白及非文字序號不增加露珠，也不建立文件", async () => {
  for (const code of ["", "wrong", null, 1000, { code: "cpx1104" }]) await assert.rejects(server.redeemCompanionCode("invalid", code, day), (error: unknown) => error instanceof server.CompanionCodeError);
  assert.equal(documents.get("freshwise.companions")?.has("invalid") ?? false, false);
});
await check("活動序號額外增加1000露珠，保留成長、印章及任務進度", async () => {
  await server.applyCompanionAction("owner", { kind: "care", action: "play" }, day);
  await server.applyCompanionAction("owner", { kind: "events", events: [{ type: "chart" }] }, day);
  await server.applyCompanionAction("owner", { kind: "claim", quest: "chart" }, day);
  const before = await server.loadCompanion("owner", day);
  const result = await server.redeemCompanionCode("owner", "cpx1104", day);
  assert.equal(result.reward, 1000);
  assert.deepEqual(result.state, { ...before, dew: before.dew + 1000 });
});
await check("相同帳號能重複兌換，前後空白與大小寫同樣有效", async () => {
  await server.redeemCompanionCode("case", " CPX1104 ", day);
  await server.redeemCompanionCode("case", "cpx1104", day);
  assert.equal((await server.loadCompanion("case", day)).dew, 2006);
});
await check("同時送出20次有效兌換，每次都增加1000露珠", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => server.redeemCompanionCode("concurrent", "cpx1104", day)));
  assert.equal(results.length, 20);
  assert.equal((await server.loadCompanion("concurrent", day)).dew, 20006);
});
await check("舊版已兌換紀錄不再阻擋活動序號", async () => {
  documents.get("freshwise.companions")!.set("previous-code", { _id: "previous-code", state: companions.initialCompanionState(day), redeemedCodes: ["cpx1104"] });
  await server.redeemCompanionCode("previous-code", "cpx1104", day);
  await server.redeemCompanionCode("previous-code", "cpx1104", day);
  assert.equal((await server.loadCompanion("previous-code", day)).dew, 2006);
});
await check("澆水與兌換同時進行，不遺失1000露珠或澆水成長", async () => {
  await server.applyCompanionAction("water", { kind: "care", action: "play" }, day);
  await Promise.all([server.redeemCompanionCode("water", "cpx1104", day), server.applyCompanionAction("water", { kind: "care", action: "water" }, day)]);
  const state = await server.loadCompanion("water", day);
  assert.equal(state.dew, 1003);
  assert.equal(state.xp, 5);
});
await check("舊文件沒有版本欄位，也能兌換且並行寫入不互相覆蓋", async () => {
  documents.get("freshwise.companions")!.set("legacy", { _id: "legacy", state: companions.initialCompanionState(day) });
  await Promise.all([server.redeemCompanionCode("legacy", "cpx1104", day), server.applyCompanionAction("legacy", { kind: "care", action: "water" }, day)]);
  assert.equal((await server.loadCompanion("legacy", day)).dew, 1003);
  assert.ok(documents.get("freshwise.companions")!.get("legacy")!.revision);
});
await check("不同帳號兌換不影響別人的露珠", async () => {
  const before = await server.loadCompanion("owner", day);
  await server.redeemCompanionCode("other", "cpx1104", day);
  assert.equal((await server.loadCompanion("other", day)).dew, 1006);
  assert.deepEqual(await server.loadCompanion("owner", day), before);
});
await check("只清除夥伴會保留菜籃與價格單位，之後仍能兌換", async () => {
  await userData.saveBasket("owner", basket.defaultBasket());
  await userData.savePrefs("owner", { ...prefs.DEFAULT_PREFS, unit: "kg" });
  const before = await userData.loadUserData("owner");
  assert.deepEqual(await server.applyCompanionAction("owner", { kind: "reset" }, day), companions.initialCompanionState(day));
  assert.deepEqual(await userData.loadUserData("owner"), before);
  assert.equal((await server.redeemCompanionCode("owner", "cpx1104", day)).state.dew, 1006);
});
await check("清除夥伴與菜籃後，空菜籃不補回且仍能兌換", async () => {
  await server.applyCompanionAction("owner", { kind: "reset" }, day);
  await userData.saveBasket("owner", basket.emptyBasket());
  const loaded = await userData.loadUserData("owner");
  assert.deepEqual(loaded.basket, basket.emptyBasket());
  assert.equal(loaded.prefs.unit, "kg");
  assert.equal(loaded.fresh, false);
  assert.deepEqual((await userData.loadUserData("owner")).basket, basket.emptyBasket());
  assert.equal((await server.redeemCompanionCode("owner", "cpx1104", day)).state.dew, 1006);
});
await check("重設後舊裝置搬家不會復原進度", async () => {
  await server.applyCompanionAction("owner", { kind: "reset" }, day);
  const legacy = { ...companions.initialCompanionState(day), dew: 999, xp: 120 };
  const loaded = await server.migrateCompanionFromDevice("owner", JSON.stringify(legacy), day);
  assert.equal(loaded.dew, 6);
  assert.equal((await server.redeemCompanionCode("owner", "cpx1104", day)).state.dew, 1006);
});
await check("其他重設入口之後仍能兌換", async () => {
  await server.deleteCompanion("other");
  assert.equal((await server.redeemCompanionCode("other", "cpx1104", day)).state.dew, 1006);
});
await check("跨日同樣能再次兌換活動序號", async () => {
  assert.equal((await server.redeemCompanionCode("case", "cpx1104", "2026-11-25")).state.dew, 3006);
});

class TestResponse extends Response {
  static json(value: unknown, init?: ResponseInit) { return new TestResponse(JSON.stringify(value), { ...init, headers: { "Content-Type": "application/json" } }); }
}
let authenticated = true;
const route = loadServer<typeof import("../app/api/freshwise/companion/route")>("../app/api/freshwise/companion/route.ts", {
  "next/server": { NextResponse: TestResponse },
  "@/lib/auth": { requireTool: async () => authenticated ? { id: "api-user" } : TestResponse.json({ error: "請先登入" }, { status: 401 }) },
  "@/lib/freshwise/companions.server": server,
  "@/lib/freshwise/companions": companions,
});
function request(body: unknown) { return new Request("http://localhost/api/freshwise/companion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
await check("API由伺服器決定1000露珠，忽略瀏覽器自訂的獎勵與使用者ID", async () => {
  const res = await route.POST(request({ action: "redeem", today: day, code: "cpx1104", reward: 999999, userId: "owner" }));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.reward, 1000);
  assert.equal(data.state.dew, 1006);
  assert.equal((await server.loadCompanion("owner", day)).dew, 1006);
});
await check("API錯誤序號回傳400，重複有效兌換回傳200", async () => {
  assert.equal((await route.POST(request({ action: "redeem", today: day, code: "wrong" }))).status, 400);
  assert.equal((await route.POST(request({ action: "redeem", today: day, code: "cpx1104" }))).status, 200);
  assert.equal((await server.loadCompanion("api-user", day)).dew, 2006);
});
await check("未登入無法兌換或重設，帳號資料保持不變", async () => {
  const before = await server.loadCompanion("api-user", day);
  authenticated = false;
  for (const body of [{ action: "redeem", code: "cpx1104" }, { action: "reset" }]) assert.equal((await route.POST(request({ ...body, today: day }))).status, 401);
  authenticated = true;
  assert.deepEqual(await server.loadCompanion("api-user", day), before);
});
console.log(`\nFreshWise 活動序號與分項清除 ${passed} 組檢查通過。`);
