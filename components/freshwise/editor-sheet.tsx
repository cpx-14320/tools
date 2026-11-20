"use client";

import type { ReactNode } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { DangerButton, GhostButton, Note, PrimaryButton } from "./ui";
import { copy } from "./theme";

/**
 * 編輯類彈窗的共用外殼（新增分類、編輯項目數量…）。
 *
 * 跟選擇器（場所／市場／品項選擇）的差別只在底部按鈕的字：**選擇器用「確定」、編輯器
 * 用「儲存」**，見 theme.ts 的 copy。兩者的外殼都是 BottomSheetModal。刪除鈕靠左、
 * 跟右邊的取消／儲存分開，避免手指誤觸。
 */
export function EditorSheet({
  open,
  title,
  description,
  onClose,
  onSave,
  saveLabel = copy.save,
  saveDisabled = false,
  onDelete,
  deleteLabel,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  /** 標題列下方的說明文字——字級固定走 Note，不要在呼叫端各自決定大小。 */
  description?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  /** 必填欄位還沒填時把儲存鈕關掉（例如分類名稱是空的）。 */
  saveDisabled?: boolean;
  /** 編輯既有資料才給，新增時不顯示刪除。 */
  onDelete?: () => void;
  deleteLabel?: string;
  /** 真的需要完全自訂底部按鈕時才用。 */
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
        {onSave && (
          <PrimaryButton onClick={onSave} disabled={saveDisabled}>
            {saveLabel}
          </PrimaryButton>
        )}
      </>
    ) : undefined;

  return (
    <BottomSheetModal open={open} title={title} onClose={onClose} footer={footer ?? defaultFooter}>
      {description && <Note>{description}</Note>}
      {children}
    </BottomSheetModal>
  );
}
