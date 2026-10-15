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
