"use client";

import type { ReactNode } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { DangerButton, GhostButton, Note, PrimaryButton } from "./ui";
import { copy } from "./theme";

/**
 * 編輯類彈窗的共用外殼。以前備忘錄、首頁設定、分類編輯、主視覺／橫幅、加入行程分類
 * 這五個彈窗各自寫了一份幾乎一樣的 markup（`fixed inset-0 z-30` ＋ 標題列 ＋ 底部
 * 取消／儲存），連「max-h 要用 % 不是 vh」那段註解都複製了五份。現在全部改走這一個
 * 外殼，外觀、堆疊層級、捲動行為只有一份實作。
 *
 * 跟選擇器（StationPickerModal、DatePickerModal…）的差別只在底部按鈕的字：**選擇器用
 * 「確定」、編輯器用「儲存」**，見 theme.ts 的 copy。兩者的外殼都是 BottomSheetModal。
 */
export function EditorSheet({
  open,
  title,
  description,
  onClose,
  onSave,
  saveLabel = copy.save,
  onDelete,
  deleteLabel,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  /** 標題列下方的說明文字（選填）——字級固定走 Note，不要在呼叫端各自決定大小。 */
  description?: string;
  onClose: () => void;
  /** 不給 onSave 時底部就只有取消（或呼叫端自己傳 footer）。 */
  onSave?: () => void;
  saveLabel?: string;
  /** 編輯既有資料才給，新增時不顯示刪除。 */
  onDelete?: () => void;
  deleteLabel?: string;
  /** 真的需要完全自訂底部按鈕時才用，會取代上面那組。 */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const defaultFooter =
    onSave || onDelete ? (
      <>
        {onDelete ? (
          <DangerButton size="md" className="mr-auto" onClick={onDelete}>
            {deleteLabel ?? copy.delete}
          </DangerButton>
        ) : null}
        <GhostButton onClick={onClose}>{copy.cancel}</GhostButton>
        {onSave && <PrimaryButton onClick={onSave}>{saveLabel}</PrimaryButton>}
      </>
    ) : undefined;

  return (
    <BottomSheetModal open={open} title={title} onClose={onClose} footer={footer ?? defaultFooter} bodyClassName="flex flex-col gap-4 px-5 py-5">
      {description && <Note>{description}</Note>}
      {children}
    </BottomSheetModal>
  );
}
