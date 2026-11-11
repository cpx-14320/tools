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

/** 刪除確認彈窗統一用這一句。
 *
 *  垃圾桶做出來之前，那些彈窗寫的是「刪掉之後沒辦法復原」——現在已經不是事實了，
 *  而且那句話會讓人在該刪的時候不敢刪。真正不可逆的是垃圾桶裡的「永久刪除」跟
 *  「清空垃圾桶」，那兩個地方才該強調沒有退路。 */
export const TRASH_RESTORE_NOTE = "刪掉的東西會先進「設定 › 最近刪除」，之後還可以還原。";

import type { CategoryColor } from "./categories";

export type TrashKind = "transaction" | "transfer" | "goal" | "recurringRule" | "account" | "accountType" | "category";

/** 垃圾桶的分頁。種類有七種，一種一個分頁太多了（而且垃圾桶平常是空的），所以收成
 *  三組＋全部：明細（交易、轉帳）、分類、帳戶（帳戶本身跟帳戶類型）。
 *
 *  存錢目標跟固定收支已經不進垃圾桶（見 goals.server.ts 的 deleteGoal），但舊資料裡
 *  可能還留著，所以 trashGroupOf 仍然要處理得了——它們歸 null，只會出現在「全部」。 */
export type TrashGroup = "all" | "entry" | "category" | "account";

export function trashGroupOf(kind: TrashKind): Exclude<TrashGroup, "all"> | null {
  if (kind === "transaction" || kind === "transfer") return "entry";
  if (kind === "category") return "category";
  if (kind === "account" || kind === "accountType") return "account";
  return null;
}

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
  /** 刪除當下那一列長什麼樣子——圖示路徑（或舊資料的表情符號）跟分類色。跟 label 一樣是
   *  **當下存起來**的快照：分類可能在這之後也被刪掉，到時候反查不到圖示。有了這兩個，
   *  垃圾桶裡的每一列就能畫成跟它被刪之前一模一樣，使用者不用重新辨認。 */
  icon?: string;
  color?: CategoryColor;
  /** 這一次刪除連帶移除了幾個文件（刪一個分類會連子分類跟預算規則一起）。 */
  docCount: number;
}
