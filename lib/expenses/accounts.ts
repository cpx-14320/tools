// 純邏輯、不碰資料庫——CRUD 在同資料夾的 accounts.server.ts（見 categories.ts 開頭的說明）。
//
// 資產總表刻意做成最簡單的版本：帳戶餘額是使用者自己手動輸入維護的數字（點開帳戶自己
// 改），不是從 expenses.transactions 自動加總算出來的。這樣不用處理「每筆交易選帳戶」
// 「轉帳」「歷史交易回頭補帳戶」這些複雜度，資產總表單純是另一個獨立的「我現在有多少
// 錢、欠多少錢」快照，跟收支流水帳（消費分類／交易紀錄）是兩回事。

export type AccountKind = "asset" | "liability";

export interface AccountDTO {
  id: string;
  name: string;
  icon: string;
  kind: AccountKind;
  /** 一律存正數，負債不用輸入負號——netWorth() 自己會把負債那塊減掉。 */
  balance: number;
}

export function accountsByKind(accounts: AccountDTO[], kind: AccountKind): AccountDTO[] {
  return accounts.filter((a) => a.kind === kind);
}

export function totalByKind(accounts: AccountDTO[], kind: AccountKind): number {
  return accountsByKind(accounts, kind).reduce((sum, a) => sum + a.balance, 0);
}

/** 淨資產＝資產總額－負債總額。 */
export function netWorth(accounts: AccountDTO[]): number {
  return totalByKind(accounts, "asset") - totalByKind(accounts, "liability");
}
