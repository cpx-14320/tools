// 純邏輯、不碰資料庫——CRUD 在同資料夾的 accounts.server.ts（見 categories.ts 開頭的說明）。
//
// 帳戶的圖示跟資產/負債都是「帳戶類型」（account-types.ts）決定的，帳戶本身只存名稱跟
// 期初餘額。顯示用的餘額＝期初餘額＋所有掛在這個帳戶上的交易加總，即時算、不做增量
// 維護——跟 transactions.ts 裡其他統計（totalsForRange／budgetSummary…）是同一套「即時從
// 交易列表算出來」的風格，不另外存一份累計數字，不然新增/編輯/刪除交易都要記得同步
// 更新，容易漏掉某個路徑。

import { accountTypeById, type AccountKind, type AccountTypeDTO } from "./account-types";
import { categoryById, type CategoryDTO } from "./categories";
import type { TransactionDTO } from "./transactions";
import type { TransferDTO } from "./transfers";

export interface AccountDTO {
  id: string;
  name: string;
  accountTypeId: string;
  /** 建立帳戶時的起始金額，一律存正數——跟即時算出來的「目前餘額」是兩個不同數字，
   *  見 accountBalance()。 */
  openingBalance: number;
}

/** 找不到對應類型（類型被刪除了）時當作資產，避免顯示層整個炸掉。 */
export function accountKind(types: AccountTypeDTO[], account: AccountDTO): AccountKind {
  return accountTypeById(types, account.accountTypeId)?.kind ?? "asset";
}

export function accountsByKind(accounts: AccountDTO[], types: AccountTypeDTO[], kind: AccountKind): AccountDTO[] {
  return accounts.filter((a) => accountKind(types, a) === kind);
}

/** 帳戶名稱不能重複（不分資產/負債，整個使用者底下唯一）——重複的話資產總表、帳戶選擇
 *  彈窗都分不出是哪一個帳戶。excludeId 讓編輯既有帳戶時不會把自己當成跟自己撞名。 */
export function accountNameTaken(accounts: AccountDTO[], name: string, excludeId?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return accounts.some((a) => a.id !== excludeId && a.name.trim() === trimmed);
}

/** 單筆交易對指定帳戶餘額的影響：資產帳戶支出扣錢／收入加錢，負債帳戶反過來
 *  （支出＝刷卡消費，負債增加；收入＝還款，負債減少）。 */
function signedDelta(tx: TransactionDTO, kind: AccountKind, categories: CategoryDTO[]): number {
  const isIncome = categoryById(categories, tx.categoryId)?.kind === "收入";
  if (kind === "asset") return isIncome ? tx.amount : -tx.amount;
  return isIncome ? -tx.amount : tx.amount;
}

/** 單筆轉帳對指定帳戶餘額的影響——把「轉入這個帳戶」當成跟收入同一種方向、「從這個
 *  帳戶轉出」當成跟支出同一種方向，套用跟 signedDelta 一樣的資產/負債正負號規則：
 *  資產帳戶轉入加錢／轉出扣錢；負債帳戶轉入（例如用轉帳還信用卡）減少欠款、轉出
 *  （例如信用卡預借現金轉進錢包）增加欠款。轉帳一定同時影響兩個帳戶，整體淨資產
 *  不會因為轉帳而改變。 */
function signedTransferDelta(transfer: TransferDTO, accountId: string, kind: AccountKind): number {
  const isReceiving = transfer.toAccountId === accountId;
  if (kind === "asset") return isReceiving ? transfer.amount : -transfer.amount;
  return isReceiving ? -transfer.amount : transfer.amount;
}

export function accountBalance(
  account: AccountDTO,
  types: AccountTypeDTO[],
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  transfers: TransferDTO[],
): number {
  const kind = accountKind(types, account);
  const txTotal = transactions
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + signedDelta(t, kind, categories), account.openingBalance);
  return transfers
    .filter((tr) => tr.fromAccountId === account.id || tr.toAccountId === account.id)
    .reduce((sum, tr) => sum + signedTransferDelta(tr, account.id, kind), txTotal);
}

/** 每一筆掛帳戶的交易／轉帳，「發生後」那個帳戶變成多少——消費紀錄列表想在金額下方
 *  多顯示一行「這筆記完，帳戶變成多少」，跟銀行月結單的「交易後餘額」同一個概念。
 *
 *  排序用「日期，同一天再比 id」：這裡沒有記到秒的時間戳記，但 Mongo 的 ObjectId 本身
 *  就是依建立時間遞增的十六進位字串，直接字串比較就等於真正的建立順序，不用另外存一個
 *  序號欄位。回傳的 key 用 `tx:<id>` / `transfer:<id>` 前綴區分兩種來源，交易跟轉帳的
 *  id 本來就來自不同的 collection，理論上不會撞，前綴純粹是防禦性的。 */
export function transactionBalancesByAccount(
  accounts: AccountDTO[],
  types: AccountTypeDTO[],
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  transfers: TransferDTO[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const account of accounts) {
    const kind = accountKind(types, account);
    const entries: { key: string; date: string; id: string; delta: number }[] = [];
    for (const t of transactions) {
      if (t.accountId === account.id) entries.push({ key: `tx:${t.id}`, date: t.date, id: t.id, delta: signedDelta(t, kind, categories) });
    }
    for (const tr of transfers) {
      if (tr.fromAccountId === account.id || tr.toAccountId === account.id) {
        entries.push({ key: `transfer:${tr.id}`, date: tr.date, id: tr.id, delta: signedTransferDelta(tr, account.id, kind) });
      }
    }
    entries.sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
    let running = account.openingBalance;
    for (const e of entries) {
      running += e.delta;
      result.set(e.key, running);
    }
  }
  return result;
}

/** 對帳：算出要補哪一筆交易，才能讓系統算出來的餘額等於使用者輸入的實際餘額。
 *
 *  餘額是「期初＋所有交易」即時算出來的，所以只要有漏記／多記，差額就會一直累積下去。
 *  與其叫使用者回頭翻完整份紀錄找出是哪一筆，不如補一筆「對帳調整」把帳拉回實際值——
 *  這也是一般記帳軟體對帳的做法。
 *
 *  方向依帳戶種類而定：資產帳戶實際比系統多＝少記了收入，少＝少記了支出；負債帳戶
 *  相反（餘額代表欠款，欠得比系統多＝少記了刷卡消費）。沒有差額時回傳 null。 */
export function reconcileAdjustment(
  kind: AccountKind,
  currentBalance: number,
  actualBalance: number,
): { kind: "支出" | "收入"; amount: number } | null {
  const diff = Math.round((actualBalance - currentBalance) * 100) / 100;
  if (diff === 0) return null;
  const increasesBalance = diff > 0;
  const needsIncome = kind === "asset" ? increasesBalance : !increasesBalance;
  return { kind: needsIncome ? "收入" : "支出", amount: Math.abs(diff) };
}

export interface BalanceDelta {
  delta: number;
  pct: number | null; // 基準那一天是 0 的話百分比沒意義，回傳 null，畫面上只顯示金額差
}

/** 兩個時間點的餘額差——跟 transactions.ts 的 rangeDelta 回傳同一種形狀（{delta, pct}），
 *  這樣資產頁也能直接用 KpiCard／DeltaText 這組既有元件，不用另外刻一份。 */
export function balanceDelta(current: number, baseline: number): BalanceDelta {
  return { delta: current - baseline, pct: baseline === 0 ? null : ((current - baseline) / baseline) * 100 };
}

export function totalByKind(
  accounts: AccountDTO[],
  types: AccountTypeDTO[],
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  transfers: TransferDTO[],
  kind: AccountKind,
): number {
  return accountsByKind(accounts, types, kind).reduce((sum, a) => sum + accountBalance(a, types, transactions, categories, transfers), 0);
}

/** 淨資產＝資產總額－負債總額。轉帳不會改變這個數字（見 signedTransferDelta 的說明），
 *  這裡還是把 transfers 傳進去算，純粹是因為 accountBalance 需要它算出個別帳戶的正確
 *  餘額，加總起來淨資產本身其實不受影響。 */
export function netWorth(
  accounts: AccountDTO[],
  types: AccountTypeDTO[],
  transactions: TransactionDTO[],
  categories: CategoryDTO[],
  transfers: TransferDTO[],
): number {
  return (
    totalByKind(accounts, types, transactions, categories, transfers, "asset") -
    totalByKind(accounts, types, transactions, categories, transfers, "liability")
  );
}
