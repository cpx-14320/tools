/** AI 產出的「待確認」草稿——純型別與邏輯，client component 可以直接 import
 *  （DB 存取在 ai-drafts.server.ts，照 lib/expenses 既有的 pure/.server 分檔慣例）。
 *
 *  為什麼要存進資料庫、而不是放在彈窗的 state 裡：每跑一次 AI 都要花錢，草稿掉了就等於
 *  那筆錢白花。而且手機上解析到一半被電話打斷、切出去再回來是常態。
 *
 *  為什麼是「一批一個文件」而不是「一筆一個文件」：使用者要能分辨「這是哪一次解析出來
 *  的」——同一句話重跑兩次會產生兩批很像的結果，混在一起就分不出哪批已經處理過了。
 *  批次本身就是文件邊界，整批確認／捨棄是一次更新，原始輸入也只存一份。 */

/** 這一批是怎麼來的。CSV 判讀之後會用到同一套待確認流程。 */
export type AiDraftSource = "text" | "csv";

export type AiDraftStatus = "pending" | "committed" | "discarded";

/** 單筆的處理狀態：寫進去了、跳過了、還是還沒決定。 */
export type AiDraftItemState = "pending" | "committed" | "skipped";

export interface AiDraftItemDTO {
  /** 批內唯一。編輯／刪除靠它定位，不用陣列索引——刪掉一筆之後索引會整個位移。 */
  key: string;
  /** null ＝ AI 判斷不出來該歸哪一類，要使用者自己補。 */
  categoryId: string | null;
  amount: number;
  date: string;
  note?: string;
  accountId?: string;
  state: AiDraftItemState;
  /** AI 原本判斷的分類路徑。使用者改過之後，還看得出它本來說什麼——之後要調 prompt
   *  或換模型時，這是唯一的判斷依據。 */
  aiGuess?: string;
}

export interface AiDraftDTO {
  id: string;
  createdAt: string;
  source: AiDraftSource;
  /** 列表上用來認出「這是哪一批」的一句話：打字的就是原句，CSV 就是檔名加筆數。 */
  inputSummary: string;
  /** 當時用哪顆模型（或 "mock"）。回頭看才知道某一批為什麼判得特別差。 */
  model: string;
  status: AiDraftStatus;
  items: AiDraftItemDTO[];
}

/** 還沒處理完的那幾筆。 */
export function pendingItems(draft: AiDraftDTO): AiDraftItemDTO[] {
  return draft.items.filter((i) => i.state === "pending");
}

/** 還沒分類的那幾筆——有這些就不能按「寫入」（交易一定要屬於某個分類）。 */
export function unclassifiedItems(draft: AiDraftDTO): AiDraftItemDTO[] {
  return pendingItems(draft).filter((i) => i.categoryId === null);
}

/** 批次清單上那一行說明：「2 筆 · 1 筆未分類」。 */
export function draftSummaryLine(draft: AiDraftDTO): string {
  const pending = pendingItems(draft);
  const unclassified = unclassifiedItems(draft);
  if (draft.status === "committed") return `${draft.items.length} 筆 · 已全部寫入`;
  if (pending.length === 0) return `${draft.items.length} 筆 · 已處理完`;
  const parts = [`${pending.length} 筆待確認`];
  if (unclassified.length > 0) parts.push(`${unclassified.length} 筆未分類`);
  return parts.join(" · ");
}
