import { categoryPath, topLevelCategories, subCategoriesOf, type CategoryDTO, type CategoryKind } from "./categories";
import { matchKeywordCategories } from "./ai-keywords";
import type { AiDraftItemDTO } from "./ai-drafts";

/** 還沒有 API 金鑰時用的「假解析」。
 *
 *  它刻意**真的去讀使用者打的句子**（切句、抓數字、用名稱關鍵字配分類），而不是回一組
 *  寫死的假資料：要驗收的是 UI 跟操作流程，而操作流程最重要的部分就是「打什麼會得到
 *  什麼、判錯了怎麼改」。回固定資料的話，使用者打什麼都一樣，等於什麼都沒測到。
 *
 *  配不到分類時回 `categoryId: null`——那是真實模型也會發生、而且一定要處理好的狀況
 *  （待確認區要擋住寫入、逼使用者自己補），用假資料時更要刻意製造出來。 */

/** 可以記帳的分類（葉節點）：沒有子分類的大分類 ＋ 所有子分類。
 *
 *  有子分類的大分類本身不能直接記帳（見 categories.ts 的 needsSubcategory），所以不管是
 *  假解析還是之後真的呼叫模型，能選的範圍都只有這一份。 */
export function leafCategories(categories: CategoryDTO[], kind?: CategoryKind): CategoryDTO[] {
  const out: CategoryDTO[] = [];
  for (const parent of topLevelCategories(categories, kind)) {
    const subs = subCategoriesOf(categories, parent.id);
    if (subs.length === 0) out.push(parent);
    else out.push(...subs);
  }
  return out;
}

/** 把一句話切成「一筆一筆」。中文的逗號、頓號、分號、換行都算分隔。 */
function splitFragments(text: string): string[] {
  return text
    .split(/[，,、;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 抓出這一段裡的金額。取最後一個數字——「午餐 2 個便當 240」要的是 240 不是 2。 */
function extractAmount(fragment: string): number | null {
  const matches = [...fragment.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, "")));
  const valid = matches.filter((n) => Number.isFinite(n) && n > 0);
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

/** 今天往前第 n 天。 */
function shiftDays(todayISO: string, days: number): string {
  const d = new Date(`${todayISO}T00:00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 從句子裡認日期。只認最常用的幾個相對說法——假解析不需要做到真模型那麼完整，
 *  但「昨天」這種一定要會，不然使用者第一次試就覺得它很笨。 */
function extractDate(fragment: string, todayISO: string): string {
  if (/前天/.test(fragment)) return shiftDays(todayISO, 2);
  if (/昨天|昨日/.test(fragment)) return shiftDays(todayISO, 1);
  return todayISO;
}

/** 一天裡的時段 → 餐別。只有「餐飲」這種照時段分子項目的分類用得上。 */
const MEAL_BY_TIME: { pattern: RegExp; sub: string }[] = [
  { pattern: /早上|上午|早餐|早午餐/, sub: "早餐" },
  { pattern: /中午|午餐|午飯/, sub: "午餐" },
  { pattern: /晚上|晚餐|晚飯|宵夜|傍晚/, sub: "晚餐" },
];

/** 把一個「候選分類名稱」對到這個使用者實際有的分類。
 *
 *  **大分類底下還有子項目時，不會隨便挑一個頂著。** 那會產生「自信地猜錯」——
 *  「麥當勞 89」被歸成餐飲›早餐、「捷運 32」被歸成大眾交通›月票，使用者在待確認區
 *  掃過去很可能就直接確認掉了。
 *
 *  **但也不會就此丟掉已經知道的事**：判得出大分類、只是挑不出子項目時，大分類會當成
 *  「提示」回傳（hint）。待確認區拿它把那個大分類先展開，使用者點一下子項目就好，不用
 *  從十幾個大分類重找一次。分類本身依舊算「未分類」，一樣擋住寫入——範圍縮小了，但
 *  決定還是使用者自己做的。
 *
 *  餐別是例外：句子裡有「中午」「晚上」這種時段詞時，那就是真的知道是哪一餐，
 *  不是用猜的。 */
function resolveCategoryName(
  name: string,
  fragment: string,
  leaves: CategoryDTO[],
  categories: CategoryDTO[],
): { category: CategoryDTO | null; hint: CategoryDTO | null } {
  const leaf = leaves.find((c) => c.name === name);
  if (leaf) return { category: leaf, hint: null };

  const parent = categories.find((c) => !c.parentId && c.name === name);
  if (!parent) return { category: null, hint: null };
  const subs = subCategoriesOf(categories, parent.id);
  if (subs.length === 0) return { category: parent, hint: null };

  for (const { pattern, sub } of MEAL_BY_TIME) {
    if (!pattern.test(fragment)) continue;
    const hit = subs.find((s) => s.name === sub);
    if (hit) return { category: hit, hint: null };
  }
  return { category: null, hint: parent };
}

/** 猜這一段屬於哪個分類。兩個階段：
 *
 *  1. **關鍵字字典**（ai-keywords.ts）——「全家便當」「星巴克」「捷運」這種日常用詞跟
 *     店名，字面上跟分類名稱一點都不像，但其實最常出現。字典把它們對到候選分類名稱，
 *     再去比對這個使用者實際有哪些分類。
 *  2. **字面比對**——字典沒收的詞，退回「這段文字裡有沒有出現分類名稱」。
 *
 *  兩階段都配不到就回 null（未分類），讓待確認區擋住寫入、由使用者自己選。配錯比配不到
 *  糟糕得多：配不到至少看得見，配錯卻可能被直接確認掉。
 *
 *  回傳的 hint 是「只差子項目」的那個大分類，見 resolveCategoryName。 */
function guessCategory(
  fragment: string,
  leaves: CategoryDTO[],
  categories: CategoryDTO[],
): { category: CategoryDTO | null; hint: CategoryDTO | null } {
  // 字典跟字面兩條路都可能只拿到 hint（比如「麥當勞」→ 餐飲）。先記起來，繼續試後面的
  // 候選：說不定下一個候選就是一個沒有子項目、配得起來的分類。
  let hint: CategoryDTO | null = null;

  // 1. 關鍵字字典。候選由具體排到通用（例如 ["午餐", "餐飲"]），取第一個這個使用者
  //    真的有的分類。
  for (const name of matchKeywordCategories(fragment)) {
    const r = resolveCategoryName(name, fragment, leaves, categories);
    if (r.category) return { category: r.category, hint: null };
    hint = hint ?? r.hint;
  }

  // 2. 字面比對：長的分類名稱優先，「大眾交通」要比「交通」先中。
  const bySpecificity = [...leaves].sort((a, b) => b.name.length - a.name.length);
  for (const c of bySpecificity) {
    if (c.name && fragment.includes(c.name)) return { category: c, hint: null };
  }
  for (const parent of [...categories.filter((c) => !c.parentId)].sort((a, b) => b.name.length - a.name.length)) {
    if (parent.name && fragment.includes(parent.name)) {
      const r = resolveCategoryName(parent.name, fragment, leaves, categories);
      if (r.category) return { category: r.category, hint: null };
      hint = hint ?? r.hint;
    }
  }
  return { category: null, hint };
}

/** 一次最多認幾筆。防呆用，不是遊戲規則——貼一整個月的帳單進來，回應會大到不好處理，
 *  而且待確認區一次要確認五十筆也不是好體驗。 */
export const AI_MAX_ITEMS = 20;

export function mockParse(text: string, categories: CategoryDTO[], todayISO: string): AiDraftItemDTO[] {
  // 支出跟收入一起找。收支方向由「配到哪個分類」決定，不是另外問一次——多問一次就多
  // 一個會答錯的地方，而且使用者會先被迫自己做一次分類判斷，那正是 AI 該做的事。
  const leaves = leafCategories(categories);
  const items: AiDraftItemDTO[] = [];
  for (const fragment of splitFragments(text)) {
    const amount = extractAmount(fragment);
    if (amount === null) continue; // 沒有金額就不是一筆帳
    const { category, hint } = guessCategory(fragment, leaves, categories);
    // 備註用「把數字拿掉之後剩下的字」——使用者打的是「午餐全家便當 120」，備註應該是
    // 「午餐全家便當」，不是整串含金額的原文。
    const note = fragment.replace(/\d[\d,]*\s*元?/g, "").trim();
    items.push({
      key: `${items.length}-${Math.random().toString(36).slice(2, 8)}`,
      categoryId: category?.id ?? null,
      amount,
      date: extractDate(fragment, todayISO),
      note: note || undefined,
      state: "pending",
      categoryHintId: hint?.id,
      // 只猜到大分類時也記下來（帶個問號），之後回頭看才分得出「完全不知道」跟
      // 「知道是餐飲、只是不知道哪一餐」。
      aiGuess: category ? categoryPath(categories, category.id) : hint ? hint.name + " › ?" : undefined,
    });
    if (items.length >= AI_MAX_ITEMS) break;
  }
  return items;
}
