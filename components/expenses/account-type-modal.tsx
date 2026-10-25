"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { SegmentedControl } from "./button";
import { AccountIconPicker, CategoryColorPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { accountTypeNameTaken, DEFAULT_ACCOUNT_TYPE_COLOR, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import type { CategoryColor } from "@/lib/expenses/categories";

export interface AccountTypeModalDraft {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: AccountKind;
}

/** 只用於編輯既有類型——新增一律走 AccountTypeBatchModal（跟分類「新增分類」同一種
 *  做法，見 account-type-batch-modal.tsx）。 */
export function AccountTypeModal({
  open,
  initial,
  accountTypes,
  kind,
  inUseCount,
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
  /** 有幾個帳戶掛著這個類型。大於 0 時資產/負債鎖住不能改（見下面的說明）。 */
  inUseCount: number;
  /** 編輯既有類型時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  onClose: () => void;
  onSave: (draft: AccountTypeModalDraft) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  const [color, setColor] = useState<CategoryColor>(initial?.color ?? DEFAULT_ACCOUNT_TYPE_COLOR);
  const [draftKind, setDraftKind] = useState<AccountKind>(initial?.kind ?? kind);
  // 還沒有帳戶掛在這個類型底下時才給改資產/負債——有帳戶的話翻面會把那些帳戶每一筆
  // 歷史交易的方向整個倒過來算（見 account-types.server.ts 的 updateAccountType）。
  const canChangeKind = inUseCount === 0;
  const effectiveKind = canChangeKind ? draftKind : kind;
  const isDuplicate = accountTypeNameTaken(accountTypes, effectiveKind, name, excludeId);
  const canSave = name.trim() && icon.trim() && !isDuplicate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="編輯帳戶類型"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave({ name: name.trim(), icon: icon.trim(), color, kind: effectiveKind })}
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 欄位順序跟消費分類的彈窗一致：類型→名稱→圖示→顏色。 */}
      <Field label="類型">
        {canChangeKind ? (
          <SegmentedControl
            className="self-start"
            value={draftKind}
            onChange={setDraftKind}
            options={[
              { value: "asset", label: "資產" },
              { value: "liability", label: "負債" },
            ]}
          />
        ) : (
          // 有帳戶在用就鎖住，而且要講清楚為什麼、以及怎麼做才能改——只寫「不能更改」
          // 會讓人以為是系統限制，其實是把帳戶換到別的類型就解得開。
          <p className="text-sm font-medium text-[#4A3B7C]">
            {kind === "asset" ? "資產" : "負債"}
            <span className="ml-2 text-xs font-normal text-[#9C94C4]">
              還有 {inUseCount} 個帳戶在用，改了餘額會整個反過來算；要改請先把帳戶換到別的類型
            </span>
          </p>
        )}
      </Field>
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「定存」" className={fieldInputClass} />
      </Field>
      {isDuplicate && <p className="text-xs text-[#D1517E]">已經有同樣名稱的{effectiveKind === "asset" ? "資產" : "負債"}類型了，換一個名稱吧。</p>}
      <AccountIconPicker value={icon} onChange={setIcon} />
      <CategoryColorPicker value={color} onChange={setColor} />
    </Modal>
  );
}
