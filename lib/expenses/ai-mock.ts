import { categoryPath, topLevelCategories, subCategoriesOf, type CategoryDTO, type CategoryKind } from "./categories";
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

/** 用分類名稱當關鍵字去配。先比子分類（比較具體），再比大分類。
 *
 *  真的模型會用語意理解（「全家便當」→ 餐飲），這裡只能做字面比對，所以配不到是常態
 *  ——那正好可以看到「未分類」在 UI 上長什麼樣。 */
function guessCategory(fragment: string, leaves: CategoryDTO[], categories: CategoryDTO[]): CategoryDTO | null {
  const bySpecificity = [...leaves].sort((a, b) => b.name.length - a.name.length);
  for (const c of bySpecificity) {
    if (c.name && fragment.includes(c.name)) return c;
  }
  // 名稱配不到時，試試大分類的名字（「吃了什麼餐飲」這種）；大分類有子項目就不能直接用，
  // 挑它底下第一個子項目頂著——使用者在待確認區看得到、改得掉。
  for (const parent of categories.filter((c) => !c.parentId)) {
    if (parent.name && fragment.includes(parent.name)) {
      const subs = subCategoriesOf(categories, parent.id);
      return subs.length > 0 ? subs[0] : parent;
    }
  }
  return null;
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
    const category = guessCategory(fragment, leaves, categories);
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
      aiGuess: category ? categoryPath(categories, category.id) : undefined,
    });
    if (items.length >= AI_MAX_ITEMS) break;
  }
  return items;
}
