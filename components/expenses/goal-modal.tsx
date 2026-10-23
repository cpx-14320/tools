"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { AmountField, AmountKeypad, evaluateExpr } from "./amount-keypad";
import { GoalIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { text } from "./theme";

export interface GoalModalDraft {
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  startDate?: string;
  targetDate?: string;
}

export function GoalModal({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** 沒有 initial 代表新增；新增時可以填「目前已存多少」當起始值，編輯時這個欄位不給改
   *  （已存金額改用目標卡片上的「＋ 存入」）。 */
  initial?: GoalModalDraft;
  onClose: () => void;
  onSave: (draft: GoalModalDraft) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  // 兩個金額都用彈窗下方那個固定小鍵盤輸入，target 記錄現在在編哪一個——跟新增交易
  // 彈窗編明細金額是同一套做法，不要讓其中一個欄位跳原生數字鍵盤。
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(initial ? String(initial.currentAmount) : "0");
  const [target, setTarget] = useState<"target" | "current">("target");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");

  const targetAmountNum = evaluateExpr(targetAmount);
  const currentAmountNum = evaluateExpr(currentAmount);
  const canSave = name.trim() && icon.trim() && Number.isFinite(targetAmountNum) && targetAmountNum > 0 && Number.isFinite(currentAmountNum) && currentAmountNum >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "編輯存錢目標" : "新增存錢目標"}
      fullHeight
      stickyBottom={
        <AmountKeypad
          expr={target === "target" ? targetAmount : currentAmount}
          onExprChange={target === "target" ? setTargetAmount : setCurrentAmount}
          label={target === "target" ? "目標金額" : "目前已經存了多少"}
        />
      }
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave({
              name: name.trim(),
              icon: icon.trim(),
              targetAmount: targetAmountNum,
              currentAmount: currentAmountNum,
              startDate: startDate || undefined,
              targetDate: targetDate || undefined,
            })
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「日本旅遊基金」" className={fieldInputClass} />
      </Field>
      <GoalIconPicker value={icon} onChange={setIcon} />
      <AmountField label="目標金額" value={targetAmountNum} active={target === "target"} onFocus={() => setTarget("target")} />
      {!isEdit && (
        <AmountField
          label="目前已經存了多少（可不填，預設 0）"
          value={currentAmountNum}
          active={target === "current"}
          onFocus={() => setTarget("current")}
          placeholder="還沒存就不用填"
        />
      )}
      <Field label="開始日期（可不填，純顯示用）">
        <DateField value={startDate} onChange={setStartDate} placeholder="不設定" />
      </Field>
      <Field label="目標日期（可不填）">
        <DateField value={targetDate} onChange={setTargetDate} placeholder="不設期限" />
      </Field>
    </Modal>
  );
}

export function ContributeModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  const amountNum = evaluateExpr(amount);
  const canSave = Number.isFinite(amountNum) && amountNum > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="存入"
      stickyBottom={<AmountKeypad expr={amount} onExprChange={setAmount} label="這次要存入多少" />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave(amountNum)}
          confirmDisabled={!canSave}
          confirmLabel="確認存入"
        />
      }
    >
      <p className={`${text.muted} leading-relaxed`}>用下方的鍵盤輸入這次要存入的金額。</p>
    </Modal>
  );
}
