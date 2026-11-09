// 純邏輯、不碰資料庫——CRUD 在同資料夾的 goals.server.ts（見 categories.ts 開頭的說明）。

export interface SavingsGoalDTO {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  /** 目前存了多少。
   *
   *  **綁定帳戶的目標（accountId 有值）這個欄位是算出來的**，不是資料庫裡存的數字：
   *  page.tsx 會用 withAccountBalances() 把它換成那個帳戶的當下餘額。所以畫面上、
   *  goalProgress()、goalPace() 都照用同一個欄位，不用到處判斷是哪一種模式。 */
  currentAmount: number;
  /** 綁定的帳戶。有值＝進度直接看這個帳戶的餘額（存錢本來就是把錢放在某個戶頭裡，
   *  再另外手動記一次「我存了多少」必然會跟餘額對不起來）；沒值＝手動記錄模式。 */
  accountId?: string;
  /** 純顯示用，不影響 goalPace 試算——想標記「這個目標是什麼時候開始存的」時填，
   *  跟「週期存錢」用固定收支規則連動（見 recurring-rules.ts）是兩回事，那邊規則本身
   *  才有真正決定排程的 startDate。 */
  startDate?: string;
  targetDate?: string;
}

/** 把綁定帳戶的目標的 currentAmount 換成那個帳戶的當下餘額。
 *
 *  在伺服器端（page.tsx）算好再傳給畫面，而不是讓畫面自己算：算餘額要帳戶、類型、交易、
 *  分類、轉帳五份資料，為了一個進度條把五份都塞進 client component 不划算。
 *
 *  綁定的帳戶被刪掉時當成 0——不要退回資料庫裡那個手動記錄時代的舊數字，那會變成「帳戶
 *  沒了，進度卻還停在某個看不出來自哪裡的金額」。 */
export function withAccountBalances(goals: SavingsGoalDTO[], balances: Map<string, number>): SavingsGoalDTO[] {
  return goals.map((goal) => (goal.accountId ? { ...goal, currentAmount: balances.get(goal.accountId) ?? 0 } : goal));
}

export function goalProgress(goal: SavingsGoalDTO) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  return { pct, remaining, achieved: goal.currentAmount >= goal.targetAmount };
}

export interface GoalPace {
  weeksLeft: number;
  monthsLeft: number;
  perWeek: number;
  perMonth: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** 設定了目標日期、還沒達成時，試算「平均每週／每月要存多少才能在期限內達標」；
 *  沒有期限、已經達成、或期限已過（沒辦法再回頭存）都回傳 null，畫面上就不顯示試算。 */
export function goalPace(goal: SavingsGoalDTO, today: Date = new Date()): GoalPace | null {
  if (!goal.targetDate) return null;
  const { remaining, achieved } = goalProgress(goal);
  if (achieved || remaining <= 0) return null;
  const msLeft = new Date(goal.targetDate).getTime() - today.getTime();
  if (msLeft <= 0) return null;
  const weeksLeft = Math.max(1, Math.ceil(msLeft / WEEK_MS));
  const monthsLeft = Math.max(1, Math.ceil(msLeft / MONTH_MS));
  return { weeksLeft, monthsLeft, perWeek: remaining / weeksLeft, perMonth: remaining / monthsLeft };
}
