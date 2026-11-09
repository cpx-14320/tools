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
  /** 跨行手續費這種「轉一次錢被扣掉的錢」。
   *
   *  **它不是轉帳金額的一部分**：amount 講的是兩個戶頭之間搬了多少（淨資產不變），
   *  手續費是真的消失的錢。所以手續費會另外產生一筆掛在「手續費」分類、從轉出帳戶
   *  出去的支出交易（見 transfers.server.ts），淨資產才對得起來。 */
  fee?: number;
  /** 由「轉帳」類型的固定收支規則確認入帳時才有值（見 recurring-rules.server.ts）；
   *  手動記的轉帳不會有這個欄位，也不能透過一般的新增／編輯 API 設定它。固定收支頁
   *  靠它算出「已入帳幾期」。 */
  sourceRuleId?: string;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
  fee?: number;
}

/** 跟指定帳戶有關的轉帳（不管是轉出還是轉入）——帳戶明細頁把這份跟一般交易合併顯示用。 */
export function transfersForAccount(transfers: TransferDTO[], accountId: string): TransferDTO[] {
  return transfers.filter((t) => t.fromAccountId === accountId || t.toAccountId === accountId);
}
