import { nextPetEmotion, petEmotionFile, PET_EMOTIONS, petCareFile, PET_CARE_ACTIONS, petStage, petBaseFile, petPoseFile, petLookStage } from "../lib/freshwise/pet-expressions";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { careForCompanion, chooseCompanionLook, PLAY_XP_GAIN, QUESTS, WATER_DEW_COST, WATER_XP_GAIN, claimCompanionQuest, companionDay, COMPANIONS, dailyState, initialCompanionState, levelOf, newlyFilledQuantity, parseCompanionState, questProgress, recordCompanionEvent, selectCompanion, XP_PER_LEVEL } from "../lib/freshwise/companions";
import { CATALOG } from "../lib/freshwise/catalog";
import { ITEM_ART_GROUPS, itemArtwork } from "../lib/freshwise/art-assets";

let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`✓ ${name}`); }
const day = "2026-11-21";
/** 露珠相關的檢查一律從常數算，不要硬寫數字——獎勵或澆水成本一調，壞的應該是功能不是檢查。 */
const INITIAL_DEW = initialCompanionState(day).dew;
const QUEST_REWARD = QUESTS[0].reward;
check("任務日期在臺灣午夜切換", () => { assert.equal(companionDay(new Date("2026-11-20T15:59:59Z")), "2026-11-20"); assert.equal(companionDay(new Date("2026-11-20T16:00:00Z")), day); });
check("新帳號有夥伴、但露珠是 0（澆水要先完成任務換）", () => {
  const s = initialCompanionState(day);
  assert.equal(s.active, "cabbage");
  assert.equal(COMPANIONS[0].threshold, 0);
  assert.equal(s.dew, 0);
  assert.deepEqual(careForCompanion(s, "water", day), s);
});
check("重複查看同一食材不刷探索進度", () => { const s = recordCompanionEvent(initialCompanionState(day), { type: "view", code: "FA1" }, day); assert.deepEqual(recordCompanionEvent(s, { type: "view", code: "FA1" }, day).visited, ["FA1"]); });
check("未完成任務不能領獎", () => { const s = initialCompanionState(day); assert.deepEqual(claimCompanionQuest(s, "explore", day), s); });
check("查看三個不同品項後，只能領一次探索獎勵", () => { let s = initialCompanionState(day); for (const code of ["FA1", "FB2", "RA1"]) s = recordCompanionEvent(s, { type: "view", code }, day); assert.equal(questProgress(s, "explore"), 3); s = claimCompanionQuest(s, "explore", day); assert.equal(s.dew, INITIAL_DEW + QUEST_REWARD); assert.equal(s.stamps, 4); assert.deepEqual(claimCompanionQuest(s, "explore", day), s); });
check("所有任務只獎勵觀察與整理事件", () => { let s = initialCompanionState(day); s = recordCompanionEvent(s, { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); s = recordCompanionEvent(s, { type: "basket" }, day); s = claimCompanionQuest(s, "basket", day); assert.equal(s.dew, INITIAL_DEW + QUEST_REWARD * 2); assert.equal(s.stamps, 8); assert.equal(COMPANIONS[1].threshold <= s.stamps, true); });
check("三個今日任務各給一次獎勵與印章，重複領取不再加獎", () => { let s = initialCompanionState(day); for (const code of ["FA1", "FB2", "RA1"]) s = recordCompanionEvent(s, { type: "view", code }, day); s = recordCompanionEvent(s, { type: "chart" }, day); s = recordCompanionEvent(s, { type: "basket" }, day); for (const quest of ["explore", "chart", "basket"] as const) { s = claimCompanionQuest(s, quest, day); assert.deepEqual(claimCompanionQuest(s, quest, day), s); } assert.equal(s.dew, INITIAL_DEW + QUEST_REWARD * 3); assert.equal(s.stamps, 12); });
check("澆水扣露珠並成長，餘額不足不能繼續扣", () => {
  // 初始 6 顆澆不動一次 10 顆的水——這是刻意的：澆水要先去完成任務換露珠。
  const fresh = initialCompanionState(day);
  assert.ok(fresh.dew < WATER_DEW_COST);
  assert.deepEqual(careForCompanion(fresh, "water", day), fresh);

  let s = { ...fresh, dew: WATER_DEW_COST * 2 };
  s = careForCompanion(s, "water", day);
  s = careForCompanion(s, "water", day);
  assert.equal(s.dew, 0);
  assert.equal(s.xp, WATER_XP_GAIN * 2);
  assert.deepEqual(careForCompanion(s, "water", day), s);
});
check("每天第一次陪玩增加成長，重複陪玩不刷獎勵", () => { const s = careForCompanion(initialCompanionState(day), "play", day); assert.equal(s.xp, PLAY_XP_GAIN); assert.deepEqual(careForCompanion(s, "play", day), s); });
check("跨日保留夥伴成長，重置日任務而不懲罰離線", () => { let s = careForCompanion(initialCompanionState(day), "play", day); s = recordCompanionEvent(s, { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); const next = dailyState(s, "2026-11-24"); assert.equal(next.xp, s.xp); assert.equal(next.dew, s.dew); assert.equal(next.stamps, s.stamps); assert.equal(next.chart, false); assert.equal(next.played, false); assert.deepEqual(next.claimed, []); });
check("同一任務可以在下一天完成後再領一次", () => { let s = recordCompanionEvent(initialCompanionState(day), { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); s = recordCompanionEvent(s, { type: "chart" }, "2026-11-22"); s = claimCompanionQuest(s, "chart", "2026-11-22"); assert.equal(s.dew, INITIAL_DEW + QUEST_REWARD * 2); assert.equal(s.stamps, 8); });
check("損壞與未知版本的儲存會安全回到初始狀態", () => { for (const raw of [null, "broken", "null", '{"version":99}']) assert.deepEqual(parseCompanionState(raw, day), initialCompanionState(day)); });
check("不能載入負數、無效進度、尚未解鎖的角色", () => { const s = parseCompanionState(JSON.stringify({ version: 1, day, dew: -3, xp: "abc", active: "corn", stamps: 0, visited: ["FA1", "FA1", "../x"], claimed: ["unknown"] }), day); assert.equal(s.dew, 0); assert.equal(s.xp, 0); assert.equal(s.active, "cabbage"); assert.deepEqual(s.visited, ["FA1"]); assert.deepEqual(s.claimed, []); });
check("重新載入會保留已領獎狀態，不能重領", () => { let s = recordCompanionEvent(initialCompanionState(day), { type: "chart" }, day); s = claimCompanionQuest(s, "chart", day); const loaded = parseCompanionState(JSON.stringify(s), day); assert.deepEqual(claimCompanionQuest(loaded, "chart", day), loaded); });
check("只有原本未填而現在填入正份量，才算整理完成", () => { const before = [{ id: "one", qtyCatty: null }]; assert.equal(newlyFilledQuantity(before, [{ id: "one", qtyCatty: 2 }]), true); for (const qtyCatty of [0, -1, Infinity, NaN]) assert.equal(newlyFilledQuantity(before, [{ id: "one", qtyCatty }]), false); assert.equal(newlyFilledQuantity([{ id: "one", qtyCatty: 1 }], [{ id: "one", qtyCatty: 2 }]), false); });
check("讀取新日期的儲存不帶入舊日任務", () => { const s = recordCompanionEvent(initialCompanionState("2026-11-20"), { type: "view", code: "FA1" }, "2026-11-20"); assert.deepEqual(parseCompanionState(JSON.stringify(s), day).visited, []); });
check("每位夥伴各自成長，切換不會覆蓋另一位進度", () => { let s = { ...initialCompanionState(day), stamps: 2, dew: WATER_DEW_COST * 3 }; s = careForCompanion(s, "water", day); s = selectCompanion(s, "radish"); assert.equal(s.xp, 0); s = careForCompanion(s, "water", day); s = careForCompanion(s, "play", day); assert.equal(s.xp, WATER_XP_GAIN + PLAY_XP_GAIN); s = selectCompanion(s, "cabbage"); assert.equal(s.xp, WATER_XP_GAIN); const loaded = parseCompanionState(JSON.stringify(s), day); assert.equal(loaded.growth.radish, WATER_XP_GAIN + PLAY_XP_GAIN); assert.equal(selectCompanion(loaded, "corn"), loaded); });
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
check("六位夥伴各有四張獨立輕量表情素材", () => { const paths = new Set<string>(); for (const pet of COMPANIONS) for (const mood of PET_EMOTIONS) { const url = petEmotionFile(pet.id, mood); assert.match(url, /^\/freshwise\/pet-[a-z-]+-stage-0[123]-(surprised|happy|sad|curious)\.webp$/); assert.ok(!paths.has(url)); paths.add(url); const file = join(process.cwd(), "public", url); assert.ok(existsSync(file), file); assert.ok(statSync(file).size <= 135 * 1024, file); } assert.equal(paths.size, 24); });
check("六位夥伴各有澆水與玩球獨立輕量圖，與表情素材不共用檔案", () => { const paths = new Set<string>(); for (const pet of COMPANIONS) for (const action of PET_CARE_ACTIONS) { const url = petCareFile(pet.id, action); assert.match(url, /^\/freshwise\/pet-[a-z-]+-stage-0[123]-action-(water|play)\.webp$/); assert.ok(!paths.has(url)); paths.add(url); const file = join(process.cwd(), "public", url); assert.ok(existsSync(file), file); assert.ok(statSync(file).size <= 100 * 1024, file); for (const mood of PET_EMOTIONS) assert.notEqual(url, petEmotionFile(pet.id, mood)); } assert.equal(paths.size, 12); });
check("六位夥伴依1–3、4–7、8以上等級切換，所有表情照護圖都屬於同階段", () => {
  for (const pet of COMPANIONS) for (const [level, stage] of [[1,1],[3,1],[4,2],[7,2],[8,3],[25,3]] as const) {
    assert.equal(petStage(pet.id, level), stage);
    for (const pose of ["neutral", ...PET_EMOTIONS, ...PET_CARE_ACTIONS] as const) {
      const url = petPoseFile(pet.id, pose, stage);
      assert.ok(existsSync(join(process.cwd(), "public", url)), url);
      // 三個階段的命名一模一樣（`-stage-01/02/03`）——第三階以前沒有這段後綴，程式裡
      // 就得為它開特例。這一條就是在守住「不要再有特例」。
      assert.ok(url.includes(`-stage-0${stage}`), url);
    }
    assert.equal(petPoseFile(pet.id, "neutral", stage), petBaseFile(pet.id, stage));
    // 網頁用圖一律是 webp（PNG 母圖留在素材庫）。
    assert.match(petBaseFile(pet.id, stage), new RegExp(`-stage-0${stage}\.webp$`));
  }
});

check("連點澆水不會超扣：扣到不夠就停，而且扣款與成長一定成對", () => {
  const day = companionDay();
  // 剛好夠澆兩次半。模擬「連點五下」——每一下都拿上一次的結果再算一次，就是 store 裡
  // care() 的行為（它讀的是同步更新的 ref，不是 React state）。
  let s = { ...initialCompanionState(day), dew: WATER_DEW_COST * 2 + 5 };
  const startDew = s.dew;
  let applied = 0;
  for (let i = 0; i < 5; i++) {
    const next = careForCompanion(s, "water", day);
    if (next === s || next.xp === s.xp) continue;   // 不夠了就是原狀態
    applied++;
    s = next;
  }
  assert.equal(applied, 2, "只該成功兩次");
  assert.equal(s.dew, startDew - WATER_DEW_COST * 2);
  assert.equal(s.xp, WATER_XP_GAIN * 2);
  // 扣款與成長是同一個物件算出來的，所以兩邊的次數一定一致——這一條就是在守這件事。
  assert.equal((startDew - s.dew) / WATER_DEW_COST, s.xp / WATER_XP_GAIN);
  // 餘額不足時完全不動（不是扣一半）。
  assert.deepEqual(careForCompanion(s, "water", day), s);
});

check("外觀可以挑回長到過的階段，挑不到還沒長到的", () => {
  const day = companionDay();
  // 第 8 級的夥伴（第三階）可以挑回第一、二階；0 代表跟等級走。
  let state = initialCompanionState(day);
  state = { ...state, stamps: 99, growth: { ...state.growth, cabbage: XP_PER_LEVEL * 7 } };
  assert.equal(levelOf(state.growth.cabbage), 8);
  assert.equal(petLookStage(state, "cabbage"), 3);
  for (const choice of [1, 2, 3] as const) {
    const picked = chooseCompanionLook(state, "cabbage", choice);
    assert.equal(picked.look.cabbage, choice);
    assert.equal(petLookStage(picked, "cabbage"), choice);
  }
  // 0 ＝ 回到跟等級走
  assert.equal(petLookStage(chooseCompanionLook(state, "cabbage", 0), "cabbage"), 3);

  // 還在第一階的夥伴挑不到第二、三階——提前看到獎勵，升級那一刻就沒有變化了。
  const rookie = { ...initialCompanionState(day), stamps: 99 };
  assert.equal(petLookStage(rookie, "cabbage"), 1);
  for (const choice of [2, 3] as const) assert.equal(chooseCompanionLook(rookie, "cabbage", choice).look.cabbage, 0);

  // 印章不夠、還沒結識的夥伴也不能挑。
  const locked = initialCompanionState(day);
  assert.equal(chooseCompanionLook(locked, "corn", 1).look.corn, 0);

  // 存檔裡有一個超過目前階段的值（降級或改過資料）時，畫面要退回等級該有的那一階。
  const stale = { ...rookie, look: { ...rookie.look, cabbage: 3 as const } };
  assert.equal(petLookStage(stale, "cabbage"), 1);
});

check("舊存檔沒有 look 欄位時當成跟等級走", () => {
  const day = companionDay();
  const raw = JSON.stringify({ version: 1, day, dew: 6, xp: 0, stamps: 0, active: "cabbage", growth: { cabbage: 0 } });
  const parsed = parseCompanionState(raw, day);
  assert.deepEqual(parsed.look, { cabbage: 0, radish: 0, strawberry: 0, pumpkin: 0, eggplant: 0, corn: 0 });
});
console.log(`\nFreshWise 養成與素材核心 ${passed} 組檢查通過。`);
