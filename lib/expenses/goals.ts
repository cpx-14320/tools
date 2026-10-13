// 純邏輯、不碰資料庫——CRUD 在同資料夾的 goals.server.ts（見 categories.ts 開頭的說明）。

export interface SavingsGoalDTO {
  id: string;
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  /** 純顯示用，不影響 goalPace 試算——想標記「這個目標是什麼時候開始存的」時填，
   *  跟「週期存錢」用固定收支規則連動（見 recurring-rules.ts）是兩回事，那邊規則本身
   *  才有真正決定排程的 startDate。 */
  startDate?: string;
  targetDate?: string;
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
