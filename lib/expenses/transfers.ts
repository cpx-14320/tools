// 純邏輯、不碰資料庫——CRUD 在同資料夾的 transfers.server.ts（見 categories.ts 開頭的說明）。
//
// 轉帳＝使用者「自己兩個帳戶之間」搬錢（提款存進戶頭、信用卡還款、日常錢包領現金…），
// 不是支出也不是收入，淨資產不會因為轉帳而改變——所以刻意不走 transactions／categories
// 那一套，不會出現在消費分類佔比、預算、報表的支出/收入統計裡，只影響兩個帳戶各自的
// 餘額（見 accounts.ts 的 accountBalance 現在也會吃這份 transfers 清單）。

export interface TransferDTO {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

/** 跟指定帳戶有關的轉帳（不管是轉出還是轉入）——帳戶明細頁把這份跟一般交易合併顯示用。 */
export function transfersForAccount(transfers: TransferDTO[], accountId: string): TransferDTO[] {
  return transfers.filter((t) => t.fromAccountId === accountId || t.toAccountId === accountId);
}
