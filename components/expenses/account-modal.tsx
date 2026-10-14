"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { accountTypesByKind, type AccountTypeDTO } from "@/lib/expenses/account-types";

export interface AccountModalDraft {
  name: string;
  accountTypeId: string;
  openingBalance: number;
}

export function AccountModal({
  open,
  accountTypes,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  accountTypes: AccountTypeDTO[];
  initial?: AccountModalDraft;
  onClose: () => void;
  onSave: (draft: AccountModalDraft) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountTypeId, setAccountTypeId] = useState(initial?.accountTypeId ?? "");
  const [openingBalance, setOpeningBalance] = useState(initial ? String(initial.openingBalance) : "");

  const balanceNum = Number(openingBalance);
  const canSave = name.trim() && accountTypeId && Number.isFinite(balanceNum) && balanceNum >= 0;
  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selectedKind = accountTypes.find((t) => t.id === accountTypeId)?.kind;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯帳戶" : "新增帳戶"}
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
            <Button disabled={!canSave} onClick={() => onSave({ name: name.trim(), accountTypeId, openingBalance: balanceNum })}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="帳戶類型">
        <select value={accountTypeId} onChange={(e) => setAccountTypeId(e.target.value)} className={fieldInputClass}>
          <option value="" disabled>
            選擇帳戶類型
          </option>
          {assetTypes.length > 0 && (
            <optgroup label="資產">
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </optgroup>
          )}
          {liabilityTypes.length > 0 && (
            <optgroup label="負債">
              {liabilityTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </Field>
      {accountTypes.length === 0 && <p className="text-xs text-[#D1517E]">還沒有帳戶類型，請先到「帳戶類型」頁面新增。</p>}
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「主要活存帳戶」「緊急備用金」" className={fieldInputClass} />
      </Field>
      <Field label={selectedKind === "liability" ? "期初欠款（輸入正數）" : "期初餘額"}>
        <input type="number" min={0} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={fieldInputClass} />
      </Field>
    </Modal>
  );
}
