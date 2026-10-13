// 純邏輯、不碰資料庫——CRUD 在同資料夾的 recurring-rules.server.ts（見 categories.ts 開頭的說明）。
//
// 「固定收支」只負責算出每一期應該在哪一天發生、算到今天總共該發生幾次；真正算不算一筆
// 消費／收入，要等使用者在畫面上按「確認存入」才會變成一筆獨立的 expenses.transactions
// 紀錄（見 recurring-rules.server.ts 的 confirmOccurrence）。那筆交易是獨立快照，之後
// 規則被刪除、暫停、甚至循環次數改掉都不會回頭影響已經確認過的歷史紀錄。

export type RecurrenceFrequencyUnit = "day" | "week" | "month";

export interface RecurringRuleDTO {
  id: string;
  categoryId: string;
  amount: number;
  note?: string;
  frequencyUnit: RecurrenceFrequencyUnit;
  /** 每隔幾個單位算一次，例如 frequencyUnit="month" + interval=2 = 每兩個月一次。 */
  interval: number;
  startDate: string; // YYYY-MM-DD，第 0 次（第一次）發生的日期
  /** 總共循環幾次；留空＝無限期（例如房租沒有約定終止日）。 */
  cycleCount?: number;
  active: boolean;
}

export interface RecurringRuleInput {
  categoryId: string;
  amount: number;
  note?: string;
  frequencyUnit: RecurrenceFrequencyUnit;
  interval: number;
  startDate: string;
  cycleCount?: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

type RuleTiming = Pick<RecurringRuleDTO, "startDate" | "frequencyUnit" | "interval">;

/** 規則第 occurrenceIndex 次（0-indexed，第一次＝0）發生在哪一天。月份進位沿用 JS Date
 *  原生的溢位規則（例如 1/31 加一個月會變成 3/2 或 3/3），不特別做「鎖在月底」的補位——
 *  跟 date-filter.ts 的 shiftYearMonth 同一種「單純、好預期」的取捨。 */
export function occurrenceDate(rule: RuleTiming, occurrenceIndex: number): string {
  const start = parseDate(rule.startDate);
  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  const step = interval * occurrenceIndex;
  if (rule.frequencyUnit === "day") return toDateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + step));
  if (rule.frequencyUnit === "week") return toDateStr(new Date(start.getFullYear(), start.getMonth(), start.getDate() + step * 7));
  return toDateStr(new Date(start.getFullYear(), start.getMonth() + step, start.getDate()));
}

type RuleSpan = RuleTiming & Pick<RecurringRuleDTO, "cycleCount">;

/** 規則最後一次發生的日期；cycleCount 沒填（無限期）回傳 null。 */
export function ruleEndDate(rule: RuleSpan): string | null {
  if (!rule.cycleCount || rule.cycleCount <= 0) return null;
  return occurrenceDate(rule, rule.cycleCount - 1);
}

/** 規則的循環是否已經全部跑完（最後一次發生日已經過了指定的日期）。無限期規則永遠是 false。 */
export function isRuleFinished(rule: RuleSpan, today: string): boolean {
  const end = ruleEndDate(rule);
  return end !== null && end < today;
}

export interface RuleOccurrence {
  /** 第幾次發生（0-indexed），存入交易紀錄時不需要這個欄位，純粹是算的過程中用來定位。 */
  index: number;
  date: string;
}

/** 截至 untilDate（含）為止，這條規則「應該」發生過幾次、分別是哪幾天——無限期規則也不會
 *  真的算出無窮多筆，因為迴圈一遇到超過 untilDate 的日期就停止；cycleCount 跟 untilDate
 *  兩個邊界取交集。 */
export function occurrencesUpTo(rule: RuleSpan, untilDate: string): RuleOccurrence[] {
  if (rule.startDate > untilDate) return [];
  const result: RuleOccurrence[] = [];
  const maxIndex = rule.cycleCount && rule.cycleCount > 0 ? rule.cycleCount - 1 : Infinity;
  for (let i = 0; i <= maxIndex; i++) {
    const date = occurrenceDate(rule, i);
    if (date > untilDate) break;
    result.push({ index: i, date });
  }
  return result;
}

export interface OccurrenceStatus extends RuleOccurrence {
  confirmed: boolean;
  /** 已確認的那一期對應到哪筆 expenses.transactions，畫面上可以直接連過去看／編輯。 */
  transactionId?: string;
}

/** 把「應該發生的期數」跟「使用者已經按過確認存入、變成真正交易紀錄的那幾期」對起來。
 *  confirmedByDate 用發生日期當 key——同一條規則同一天正常只會被確認一次
 *  （見 recurring-rules.server.ts 的唯一索引）。 */
export function occurrenceStatuses(rule: RuleSpan, confirmedByDate: Map<string, string>, today: string): OccurrenceStatus[] {
  return occurrencesUpTo(rule, today).map((occ) => ({
    ...occ,
    confirmed: confirmedByDate.has(occ.date),
    transactionId: confirmedByDate.get(occ.date),
  }));
}

/** 目前最早一筆「已經到期、但使用者還沒按確認存入」的那一期；畫面上可以用這個顯示
 *  「本期應存 NT$299，還沒存」的提示。全部都確認過，或規則還沒輪到第一期，回傳 null。 */
export function nextPendingOccurrence(statuses: OccurrenceStatus[]): OccurrenceStatus | null {
  return statuses.find((s) => !s.confirmed) ?? null;
}

const UNIT_LABEL: Record<RecurrenceFrequencyUnit, string> = { day: "天", week: "週", month: "月" };

/** 「每月」「每 2 週」這種頻率摘要文字，interval=1 不顯示數字，跟平常說話的習慣一致。 */
export function describeFrequency(rule: Pick<RecurringRuleDTO, "frequencyUnit" | "interval">): string {
  const unit = UNIT_LABEL[rule.frequencyUnit];
  return rule.interval > 1 ? `每 ${rule.interval} ${unit}` : `每${unit}`;
}

/** 「循環 24 期」或「無限期循環」。 */
export function describeCycle(rule: Pick<RecurringRuleDTO, "cycleCount">): string {
  return rule.cycleCount ? `循環 ${rule.cycleCount} 期` : "無限期循環";
}
