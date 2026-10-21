// 純邏輯、不碰資料庫——CRUD 在同資料夾的 budgets.server.ts（見 categories.ts 開頭的說明）。
//
// 預算的資料模型是「生效月份」而不是「每個月一筆」：使用者設「購物從 2026-01 起 2000」，
// 之後每個月都是 2000，直到下一筆「購物從 2026-07 起 3000」出現為止，七月以後才變 3000，
// 回頭看六月仍然是 2000。這樣調整預算只要在要改的那個月加一筆，不用每個月都重設一次，
// 歷史月份看到的也是當時真正的預算，不會被之後的調整追溯蓋掉。
//
// 原本預算是存在分類身上的一個固定數字（category.budgetAmount），那個做法沒辦法表達
// 「幾月開始變多少」，已經改成這套、不再使用。

export interface BudgetRuleDTO {
  id: string;
  categoryId: string;
  /** 這筆金額從哪個月開始生效，格式 YYYY-MM。 */
  effectiveFrom: string;
  /** 0 代表「從這個月起這個分類不編預算」，是有意義的設定，不是沒設定。 */
  amount: number;
}

export interface BudgetRuleInput {
  categoryId: string;
  effectiveFrom: string;
  amount: number;
}

export function isValidYearMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/** 某個分類在指定月份的預算＝生效月份小於等於該月的規則裡，月份最大的那一筆。
 *  都沒有（第一筆規則的生效月份還在未來）就回傳 undefined，代表那個月沒編預算。 */
export function budgetForMonth(rules: BudgetRuleDTO[], categoryId: string, yearMonth: string): number | undefined {
  let best: BudgetRuleDTO | undefined;
  for (const rule of rules) {
    if (rule.categoryId !== categoryId) continue;
    if (rule.effectiveFrom > yearMonth) continue;
    if (!best || rule.effectiveFrom > best.effectiveFrom) best = rule;
  }
  return best?.amount;
}


/** 這個分類目前這一串生效規則，照月份排好——預算設定頁展開某個分類時列出
 *  「哪個月開始改成多少」的變更歷史用。 */
export function rulesForCategory(rules: BudgetRuleDTO[], categoryId: string): BudgetRuleDTO[] {
  return rules.filter((r) => r.categoryId === categoryId).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** 舊資料相容：改成生效月份模型之前，預算是存在分類身上的 category.budgetAmount。
 *  那些舊值沒有「從哪個月開始」的資訊，所以當成「從一開始就是這個金額」補一筆
 *  虛擬規則進來，使用者的預算才不會因為改版就憑空消失。只有「完全沒有任何新規則」
 *  的分類才補——一旦在預算設定頁設過新的，就以新的為準，舊值不再參與計算。 */
export function withLegacyCategoryBudgets(
  rules: BudgetRuleDTO[],
  categories: { id: string; budgetAmount?: number }[],
): BudgetRuleDTO[] {
  const hasRule = new Set(rules.map((r) => r.categoryId));
  const legacy = categories.flatMap((c) =>
    !hasRule.has(c.id) && c.budgetAmount && c.budgetAmount > 0
      ? [{ id: `legacy-${c.id}`, categoryId: c.id, effectiveFrom: "0000-01", amount: c.budgetAmount }]
      : [],
  );
  return legacy.length === 0 ? rules : [...rules, ...legacy];
}

/** 虛擬規則不是資料庫裡真的有的那一筆，不能拿去刪除／更新。 */
export function isLegacyRule(rule: BudgetRuleDTO): boolean {
  return rule.id.startsWith("legacy-");
}

/** 這個月過了幾成——用來判斷「花的速度」是不是比「時間的速度」快。
 *  只有「現在這個月」才算得出進度；看的是過去的月份就回傳 1（整個月都過完了），
 *  未來的月份回傳 0。 */
export function monthElapsedRatio(yearMonth: string, today: string): number {
  const todayYearMonth = today.slice(0, 7);
  if (yearMonth < todayYearMonth) return 1;
  if (yearMonth > todayYearMonth) return 0;
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = Number(today.slice(8, 10));
  return dayOfMonth / daysInMonth;
}

export interface BudgetPace {
  /** 照目前的速度，整個月大概會花到多少。 */
  projected: number;
  /** 預估會超出預算多少；沒有超出就是 0。 */
  projectedOver: number;
  /** 這個月還剩幾天（含今天）。 */
  daysLeft: number;
}

/** 「照這個速度月底會花到多少」——已經花掉的金額除以「月份已經過掉的比例」。
 *
 *  只在「還沒超支、但照速度會超支」的時候才有講的價值：已經超支了畫面上本來就會紅字
 *  標示，不用再預估一次；速度正常的話跳出一行預估反而是噪音。所以不符合這兩個條件時
 *  一律回傳 null，由呼叫端決定不顯示。 */
export function budgetPace(spent: number, budget: number, yearMonth: string, today: string): BudgetPace | null {
  if (budget <= 0 || spent <= 0 || spent > budget) return null;
  const elapsed = monthElapsedRatio(yearMonth, today);
  // 月初前一兩天的樣本太少，除出來的預估會誇張到沒有參考價值（1 號花 100 元就預估
  // 月底 3000），乾脆不猜。
  if (elapsed < 0.15 || elapsed >= 1) return null;
  const projected = Math.round(spent / elapsed);
  if (projected <= budget) return null;
  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return { projected, projectedOver: projected - budget, daysLeft: daysInMonth - Number(today.slice(8, 10)) + 1 };
}
