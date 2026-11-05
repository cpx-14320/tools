/** 垃圾桶——純型別，client component 可以直接 import（DB 存取在 trash.server.ts）。
 *
 *  **為什麼是獨立的集合，不是在每個文件上加 `deletedAt`**：記帳本的 server 模組裡有
 *  二十幾個 DB 查詢散在九個檔案。軟刪除等於那些全部都要加「排除已刪除」的條件，而漏掉
 *  任何一個的後果都是無聲的——刪掉的交易還算在餘額裡、刪掉的紀錄還讓帳戶刪不掉、分類頁
 *  的筆數多算。搬到獨立集合之後，資料實體上已經離開原集合，**現有查詢一行都不用改**，
 *  也不可能意外被算進去。
 *
 *  還原就是把原始文件（連同原本的 `_id`）插回去，所以指向它的 categoryId／accountId
 *  全部自動接回來，不用修補任何參照。 */

export type TrashKind = "transaction" | "transfer" | "goal" | "recurringRule" | "account" | "accountType" | "category";

export const TRASH_KIND_LABEL: Record<TrashKind, string> = {
  transaction: "交易",
  transfer: "轉帳",
  goal: "存錢目標",
  recurringRule: "固定收支",
  account: "帳戶",
  accountType: "帳戶類型",
  category: "分類",
};

export interface TrashItemDTO {
  id: string;
  deletedAt: string;
  kind: TrashKind;
  /** 清單上那一行主要文字（備註、名稱…）。存起來而不是還原時再去反查——被刪掉的分類
   *  名稱本來就已經不在分類表裡了，反查不到。 */
  label: string;
  /** 次要說明：分類路徑、金額、日期之類。 */
  sublabel?: string;
  /** 這一次刪除連帶移除了幾個文件（刪一個分類會連子分類跟預算規則一起）。 */
  docCount: number;
}
