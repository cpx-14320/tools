import { budgetForMonth, withLegacyCategoryBudgets, type BudgetRuleDTO } from "./budgets";
import { categoryById, topLevelCategories, type CategoryDTO } from "./categories";
import type { TransactionDTO } from "./transactions";

/** 首頁主視覺上那顆對話框要說的話——角色的「消費心理 OS」。
 *
 *  這不是報表，句子刻意不帶數字：數字底下的卡片已經寫得很清楚了，上面那一句要做的是
 *  「講出使用者自己心裡那句話」。判斷只決定**抽哪一池句子**，不決定講得多精確。
 *
 *  一次可能符合好幾個狀態（這個月預算已經超前、同時這週又有一筆大額支出），那就把那
 *  幾池的句子合在一起隨機抽——不是挑優先度最高的那一個。原因是這幾個狀態本來就會同時
 *  成立，硬排優先序的話排在後面的句子幾乎永遠不會出現，等於白寫。 */

/** 判斷的時間窗：近 N 日跟它前面同樣長的那一段比。7 天是因為消費習慣是以週為單位
 *  循環的（週末花得多），拿 7 比 7 才對得起來。 */
export const OS_WINDOW_DAYS = 7;

/** 門檻集中放這裡，調整不用翻程式。 */
export const OS_THRESHOLDS = {
  /** 近 7 日支出 ≥ 前 7 日的幾倍，算「暴增」。 */
  spikeRatio: 1.5,
  /** 低於這個金額不算暴增——從 80 變 200 也是 2.5 倍，但那不是一件值得講話的事。 */
  spikeMinAmount: 1000,
  /** 單筆佔近 7 日總支出多少比例，算「大額」。 */
  bigTicketShare: 0.4,
  /** 同樣要有絕對金額門檻，不然花 300 塊的那天隨便一筆都佔 40%。 */
  bigTicketMinAmount: 2000,
  /** 本月已用預算比例超出「月進度」多少，算超前。0.15 ＝ 月初過了一半卻花了 65%。 */
  budgetAheadBy: 0.15,
  /** 近 7 日支出 ≤ 前 7 日的幾成，算「收斂」。 */
  savingRatio: 0.7,
} as const;

export type PetOsMood = "idle" | "overBudget" | "spike" | "bigTicket" | "income" | "saving" | "calm";

/** 每一種狀態對應的句子池。 */
const LINES: Record<PetOsMood, string[]> = {
  idle: [
    "今天還沒有任何紀錄…是沒花錢，還是忘了記？",
    "錢包今天安靜得有點可疑",
    "空白的一頁，先從一杯咖啡開始記吧",
    "先記一筆看看，之後的數字才有東西可以比",
  ],
  overBudget: [
    "這個月的支出，好像有點超出預期了",
    "生活必需品，應該不算亂花錢吧？",
    "理性告訴我不要買，但購物車還在等我",
  ],
  spike: [
    "奇怪，明明只是湊單，怎麼又花這麼多？",
    "明明只想買一樣，怎麼購物車又滿了？",
    "免運門檻好像快到了，要再買點什麼",
    "房間好像快沒地方放了…該買嗎",
    "先買起來好了，反正以後用得到",
    "反正物價只會漲，現在買好像也合理",
  ],
  bigTicket: [
    "就當作是花錢買快樂，這筆投資可以接受",
    "這是在提升生活品質，不應該歸類為浪費",
    "買貴了嗎？我需要重新確認一下價格",
    "還好不是智商稅",
    "明明還能用，但換新的好像也不錯",
  ],
  income: [
    "離目標又更近了一步",
    "該存起來還是投資好呢",
    "上班已經夠辛苦了，買點好吃的犒賞自己吧",
  ],
  saving: [
    "不急，等特價再入手也不遲",
    "仔細想想好像用不到…取消訂單好了",
    "再比較一下好了，說不定還能省一點",
    "好像還有更划算的選項？再研究一下",
    "這個月好像有守住，繼續保持",
  ],
  calm: [
    "原來出了新品，等晚間折扣再買來試試好了",
    "折扣券放著不用，好像也是一種損失",
    "換算一下容量，嗯……好像差不多",
    "今天的帳看起來還算正常",
  ],
};

/** 今天往前第 n 天的 YYYY-MM-DD。 */
function shift(todayISO: string, days: number): string {
  const d = new Date(`${todayISO}T00:00:00`);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Window {
  expense: number;
  income: number;
  /** 這段期間單筆最大的支出。 */
  maxExpense: number;
  count: number;
}

function summarise(transactions: TransactionDTO[], categories: CategoryDTO[], from: string, to: string): Window {
  let expense = 0;
  let income = 0;
  let maxExpense = 0;
  let count = 0;
  for (const t of transactions) {
    if (t.date < from || t.date > to) continue;
    count++;
    if (categoryById(categories, t.categoryId)?.kind === "收入") {
      income += t.amount;
    } else {
      expense += t.amount;
      if (t.amount > maxExpense) maxExpense = t.amount;
    }
  }
  return { expense, income, maxExpense, count };
}

/** 本月已經花掉的錢佔編列預算的比例；沒有編任何預算就回 null（不能拿來判斷超支）。 */
function budgetUsage(
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  budgetRules: BudgetRuleDTO[],
  todayISO: string,
): number | null {
  const yearMonth = todayISO.slice(0, 7);
  const rules = withLegacyCategoryBudgets(budgetRules, categories);
  let budget = 0;
  for (const c of topLevelCategories(categories, "支出")) {
    budget += budgetForMonth(rules, c.id, yearMonth) ?? 0;
  }
  if (budget <= 0) return null;

  let spent = 0;
  for (const t of transactions) {
    if (!t.date.startsWith(yearMonth)) continue;
    if (categoryById(categories, t.categoryId)?.kind === "收入") continue;
    spent += t.amount;
  }
  return spent / budget;
}

/** 今天走到這個月的幾成（第 15 天 / 30 天 ＝ 0.5）。拿來跟預算使用率比，才知道是「超前
 *  花」還是「只是月底了本來就該花得差不多」。 */
function monthProgress(todayISO: string): number {
  const [year, month, day] = todayISO.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return day / daysInMonth;
}

/** 算出目前符合哪幾種狀態。回傳的順序沒有意義（不是優先序），呼叫端把對應的句子池
 *  全部合起來抽。 */
export function petOsMoods(
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  budgetRules: BudgetRuleDTO[],
  todayISO: string,
): PetOsMood[] {
  const recent = summarise(transactions, categories, shift(todayISO, OS_WINDOW_DAYS - 1), todayISO);
  // 完全沒有紀錄就只有一種狀態，其他判斷都建立在「有東西可以比」上面。
  if (recent.count === 0) return ["idle"];

  const previous = summarise(transactions, categories, shift(todayISO, OS_WINDOW_DAYS * 2 - 1), shift(todayISO, OS_WINDOW_DAYS));
  const moods: PetOsMood[] = [];
  const T = OS_THRESHOLDS;

  const usage = budgetUsage(transactions, categories, budgetRules, todayISO);
  if (usage !== null && usage > monthProgress(todayISO) + T.budgetAheadBy) moods.push("overBudget");

  if (recent.expense >= T.spikeMinAmount && previous.expense > 0 && recent.expense >= previous.expense * T.spikeRatio) {
    moods.push("spike");
  }

  if (recent.maxExpense >= T.bigTicketMinAmount && recent.maxExpense >= recent.expense * T.bigTicketShare) {
    moods.push("bigTicket");
  }

  if (recent.income > 0 && recent.income > previous.income) moods.push("income");

  // 「花得少」跟「花得多」不可能同時成立，所以只有前面那幾種支出狀態都沒中時才看它。
  const spendingFlagged = moods.includes("overBudget") || moods.includes("spike") || moods.includes("bigTicket");
  if (!spendingFlagged && previous.expense > 0 && recent.expense <= previous.expense * T.savingRatio) {
    moods.push("saving");
  }

  // 什麼都沒中：日子很平穩，講點不痛不癢的。
  if (moods.length === 0) moods.push("calm");
  return moods;
}

/** 洗牌用的決定性亂數（mulberry32）。
 *
 *  不能直接用 Math.random()：首頁是 Server Component，伺服器算一次、瀏覽器 hydrate 時
 *  再算一次，兩邊抽到不同句子就是 hydration mismatch，畫面還會閃一下。改成由 page.tsx
 *  產生一個 seed 當 prop 傳下來——同一次請求裡伺服器跟瀏覽器用的是同一個 seed，結果
 *  完全一致；而每次重新整理都是新的 seed，所以「每次進來換一批」仍然成立。 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 替這一次請求產生一個 seed。
 *
 *  只給 Server Component 的 page.tsx 用。那裡一次請求只算繪一次、結果直接序列化進 RSC
 *  payload，所以「每次 render 抽到不一樣的數字」這件事在那個情境下正是我們要的，不會
 *  有 client component 重新 render 就跳掉的問題。
 *
 *  放在這裡而不是寫在 page.tsx 裡面，是因為 react-hooks/purity 會擋住 render 當中直接
 *  呼叫 Math.random()——那條規則本身是對的（client component 真的會重算），只是不適用
 *  於這一個情境。收成一支有說明的函式，比在 page.tsx 掛一行 eslint-disable 清楚。 */
export function newOsSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** 首頁要輪播的那幾句，已經洗好順序。 */
export function petOsLines(
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  budgetRules: BudgetRuleDTO[],
  todayISO: string,
  seed: number,
): string[] {
  const moods = petOsMoods(transactions, categories, budgetRules, todayISO);
  // 同時符合好幾種狀態時，那幾池的句子合在一起抽（見檔案開頭的說明）。
  const pool = moods.flatMap((m) => LINES[m]);
  return seededShuffle(pool, seed);
}
