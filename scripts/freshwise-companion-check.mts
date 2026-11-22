import { nextPetEmotion, petEmotionFile, PET_EMOTIONS } from "../lib/freshwise/pet-expressions";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { careForCompanion, claimCompanionQuest, companionDay, COMPANIONS, dailyState, initialCompanionState, newlyFilledQuantity, parseCompanionState, questProgress, recordCompanionEvent, selectCompanion } from "../lib/freshwise/companions";
import { CATALOG } from "../lib/freshwise/catalog";
import { ITEM_ART_GROUPS, itemArtwork } from "../lib/freshwise/art-assets";

let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`✓ ${name}`); }
const day = "2026-11-21";
check("任務日期在臺灣午夜切換", () => { assert.equal(companionDay(new Date("2026-11-20T15:59:59Z")), "2026-11-20"); assert.equal(companionDay(new Date("2026-11-20T16:00:00Z")), day); });
check("第一次直接擁有可用的夥伴與澆水露珠", () => { const s = initialCompanionState(day); assert.equal(s.active, "cabbage"); assert.equal(COMPANIONS[0].threshold, 0); assert.equal(s.dew, 6); });
check("重複查看同一食材不刷探索進度", () => { const s = recordCompanionEvent(initialCompanionState(day), { type: "view", code: "FA1" }, day); assert.deepEqual(recordCompanionEvent(s, { type: "view", code: "FA1" }, day).visited, ["FA1"]); });
check("未完成任務不能領獎", () => { const s = initialCompanionState(day); assert.deepEqual(claimCompanionQuest(s, "explore", day), s); });
check("查看三個不同品項後，只能領一次探索獎勵", () => { let s = initialCompanionState(day); for (const code of ["FA1", "FB2", "RA1"]) s = recordCompanionEvent(s, { type: "view", code }, day); assert.equal(questProgress(s, "explore"), 3); s = claimCompanionQuest(s, "explore", day); assert.equal(s.dew, 11); assert.equal(s.stamps, 1); assert.deepEqual(claimCompanionQuest(s, "explore", day), s); });
check("所有任務只獎勵觀察與整理事件", () => { let s = initialCompanionState(day); s = recordCompanionEvent(s, { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); s = recordCompanionEvent(s, { type: "basket" }, day); s = claimCompanionQuest(s, "basket", day); assert.equal(s.dew, 12); assert.equal(s.stamps, 2); assert.equal(COMPANIONS[1].threshold <= s.stamps, true); });
check("澆水扣露珠並成長，餘額不足不能繼續扣", () => { let s = initialCompanionState(day); s = careForCompanion(s, "water", day); s = careForCompanion(s, "water", day); assert.equal(s.dew, 0); assert.equal(s.xp, 6); assert.deepEqual(careForCompanion(s, "water", day), s); });
check("每天第一次陪玩增加成長，重複陪玩不刷獎勵", () => { const s = careForCompanion(initialCompanionState(day), "play", day); assert.equal(s.xp, 2); assert.deepEqual(careForCompanion(s, "play", day), s); });
check("跨日保留夥伴成長，重置日任務而不懲罰離線", () => { let s = careForCompanion(initialCompanionState(day), "play", day); s = recordCompanionEvent(s, { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); const next = dailyState(s, "2026-11-24"); assert.equal(next.xp, s.xp); assert.equal(next.dew, s.dew); assert.equal(next.stamps, s.stamps); assert.equal(next.chart, false); assert.equal(next.played, false); assert.deepEqual(next.claimed, []); });
check("同一任務可以在下一天完成後再領一次", () => { let s = recordCompanionEvent(initialCompanionState(day), { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); s = recordCompanionEvent(s, { type: "chart" }, "2026-11-22"); s = claimCompanionQuest(s, "chart", "2026-11-22"); assert.equal(s.dew, 12); assert.equal(s.stamps, 2); });
check("損壞與未知版本的儲存會安全回到初始狀態", () => { for (const raw of [null, "broken", "null", '{"version":99}']) assert.deepEqual(parseCompanionState(raw, day), initialCompanionState(day)); });
check("不能載入負數、無效進度、尚未解鎖的角色", () => { const s = parseCompanionState(JSON.stringify({ version: 1, day, dew: -3, xp: "abc", active: "corn", stamps: 0, visited: ["FA1", "FA1", "../x"], claimed: ["unknown"] }), day); assert.equal(s.dew, 6); assert.equal(s.xp, 0); assert.equal(s.active, "cabbage"); assert.deepEqual(s.visited, ["FA1"]); assert.deepEqual(s.claimed, []); });
check("重新載入會保留已領獎狀態，不能重領", () => { let s = recordCompanionEvent(initialCompanionState(day), { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); const loaded = parseCompanionState(JSON.stringify(s), day); assert.deepEqual(claimCompanionQuest(loaded, "chart", day), loaded); });
check("只有原本未填而現在填入正份量，才算整理完成", () => { const before = [{ id: "one", qtyCatty: null }]; assert.equal(newlyFilledQuantity(before, [{ id: "one", qtyCatty: 2 }]), true); for (const qtyCatty of [0, -1, Infinity, NaN]) assert.equal(newlyFilledQuantity(before, [{ id: "one", qtyCatty }]), false); assert.equal(newlyFilledQuantity([{ id: "one", qtyCatty: 1 }], [{ id: "one", qtyCatty: 2 }]), false); });
check("讀取新日期的儲存不帶入舊日任務", () => { const s = recordCompanionEvent(initialCompanionState("2026-11-20"), { type: "view", code: "FA1" }, "2026-11-20"); assert.deepEqual(parseCompanionState(JSON.stringify(s), day).visited, []); });
check("每位夥伴各自成長，切換不會覆蓋另一位進度", () => { let s = { ...initialCompanionState(day), stamps: 2 }; s = careForCompanion(s, "water", day); s = selectCompanion(s, "radish"); assert.equal(s.xp, 0); s = careForCompanion(s, "water", day); s = careForCompanion(s, "play", day); assert.equal(s.xp, 5); s = selectCompanion(s, "cabbage"); assert.equal(s.xp, 3); const loaded = parseCompanionState(JSON.stringify(s), day); assert.equal(loaded.growth.radish, 5); assert.equal(selectCompanion(loaded, "corn"), loaded); });
// 插畫對照表本身要乾淨：代碼不重複、而且每一個都真的在目錄裡（圖畫給一個不存在的
// 代碼＝那張圖永遠不會出現）。**不要求每個品項都有圖**——新加的品項還沒畫，沒圖的
// 會退回分類的通用圖示（見 item-icon.tsx），那是設計好的退路而不是缺陷。
check("插畫對照表的代碼不重複、而且都存在於目錄", () => {
  const codes = ITEM_ART_GROUPS.flatMap((group) => group.codes);
  assert.equal(new Set(codes).size, codes.length);
  const known = new Set(CATALOG.map((i: { code: string }) => i.code));
  for (const code of codes) assert.ok(known.has(code), code);
  assert.equal(itemArtwork("unknown"), undefined);
});
check("有圖的品項查得到自己的圖", () => {
  const withArt = ITEM_ART_GROUPS.flatMap((g) => g.codes);
  for (const code of withArt) assert.ok(itemArtwork(code), code);
});
check("表情隨機切換排除目前狀態，每種情緒都抽得到", () => { for (const current of ["neutral", ...PET_EMOTIONS] as const) { const expected = PET_EMOTIONS.filter((mood) => mood !== current); const chosen = expected.map((_, index) => nextPetEmotion(current, (index + 0.5) / expected.length)); assert.deepEqual(chosen, expected); assert.equal(chosen.includes(current as typeof PET_EMOTIONS[number]), false); } });
check("表情抽樣的邊界與無效值不會產生錯誤路徑", () => { for (const current of ["neutral", ...PET_EMOTIONS] as const) for (const sample of [-1, 0, 0.999, 1, Infinity, NaN]) assert.ok(PET_EMOTIONS.includes(nextPetEmotion(current, sample))); });
check("六位夥伴各有四張獨立輕量表情素材", () => { const paths = new Set<string>(); for (const pet of COMPANIONS) for (const mood of PET_EMOTIONS) { const url = petEmotionFile(pet.id, mood); assert.match(url, /^\/freshwise\/pet-[a-z-]+\.webp$/); assert.ok(!paths.has(url)); paths.add(url); const file = join(process.cwd(), "public", url); assert.ok(existsSync(file), file); assert.ok(statSync(file).size <= 135 * 1024, file); } assert.equal(paths.size, 24); });
console.log(`\nFreshWise 養成與素材核心 ${passed} 組檢查通過。`);
