"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";

export interface AccountTypeModalDraft {
  name: string;
  icon: string;
}

/** 只用於編輯既有類型——新增一律走 AccountTypeBatchModal（跟分類「新增分類」同一種
 *  做法，見 account-type-batch-modal.tsx）。類型的資產/負債建立後不能改，這裡不提供
 *  那個欄位。 */
export function AccountTypeModal({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: AccountTypeModalDraft;
  onClose: () => void;
  onSave: (draft: AccountTypeModalDraft) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🏷️");
  const canSave = name.trim() && icon.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="編輯帳戶類型"
      footer={
        <>
          {onDelete ? (
            <Button variant="ghost" className="text-[#D1517E] hover:text-[#D1517E]" onClick={onDelete}>
              刪除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button disabled={!canSave} onClick={() => onSave({ name: name.trim(), icon: icon.trim() })}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「定存」" className={fieldInputClass} />
      </Field>
      <Field label="圖示（輸入一個表情符號）">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldInputClass} />
      </Field>
      <p className="text-xs text-[#9C94C4]">資產／負債建立後不能更改，要改的話請刪除後重新新增。</p>
    </Modal>
  );
}
