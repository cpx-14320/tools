"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { AccountIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { accountTypeNameTaken, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";

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
  accountTypes,
  kind,
  excludeId,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: AccountTypeModalDraft;
  /** 現有的所有帳戶類型，用來擋同一種資產/負債底下名稱重複。 */
  accountTypes: AccountTypeDTO[];
  kind: AccountKind;
  /** 編輯既有類型時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  onClose: () => void;
  onSave: (draft: AccountTypeModalDraft) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  const isDuplicate = accountTypeNameTaken(accountTypes, kind, name, excludeId);
  const canSave = name.trim() && icon.trim() && !isDuplicate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="編輯帳戶類型"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave({ name: name.trim(), icon: icon.trim() })}
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「定存」" className={fieldInputClass} />
      </Field>
      {isDuplicate && <p className="text-xs text-[#D1517E]">已經有同樣名稱的{kind === "asset" ? "資產" : "負債"}類型了，換一個名稱吧。</p>}
      <AccountIconPicker value={icon} onChange={setIcon} />
      <p className="text-xs text-[#9C94C4]">資產／負債建立後不能更改，要改的話請刪除後重新新增。</p>
    </Modal>
  );
}
