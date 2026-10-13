"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import type { AccountKind } from "@/lib/expenses/accounts";

export interface AccountModalDraft {
  name: string;
  icon: string;
  kind: AccountKind;
  balance: number;
}

export function AccountModal({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: AccountModalDraft;
  onClose: () => void;
  onSave: (draft: AccountModalDraft) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "💰");
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? "asset");
  const [balance, setBalance] = useState(initial ? String(initial.balance) : "");

  const balanceNum = Number(balance);
  const canSave = name.trim() && icon.trim() && Number.isFinite(balanceNum) && balanceNum >= 0;

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
            <Button disabled={!canSave} onClick={() => onSave({ name: name.trim(), icon: icon.trim(), kind, balance: balanceNum })}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="類型">
        <SegmentedControl
          className="self-start"
          value={kind}
          onChange={setKind}
          options={[
            { value: "asset", label: "資產" },
            { value: "liability", label: "負債" },
          ]}
        />
      </Field>
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「現金錢包」「信用卡」" className={fieldInputClass} />
      </Field>
      <Field label="圖示（輸入一個表情符號）">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label={kind === "liability" ? "目前欠款（輸入正數）" : "目前餘額"}>
        <input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} className={fieldInputClass} />
      </Field>
    </Modal>
  );
}
