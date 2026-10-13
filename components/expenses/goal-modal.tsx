"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";

export interface GoalModalDraft {
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
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
  const [icon, setIcon] = useState(initial?.icon ?? "🎯");
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(initial ? String(initial.currentAmount) : "0");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");

  const targetAmountNum = Number(targetAmount);
  const currentAmountNum = Number(currentAmount);
  const canSave = name.trim() && icon.trim() && Number.isFinite(targetAmountNum) && targetAmountNum > 0 && Number.isFinite(currentAmountNum) && currentAmountNum >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "編輯存錢目標" : "新增存錢目標"}
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
            <Button
              disabled={!canSave}
              onClick={() =>
                onSave({
                  name: name.trim(),
                  icon: icon.trim(),
                  targetAmount: targetAmountNum,
                  currentAmount: currentAmountNum,
                  targetDate: targetDate || undefined,
                })
              }
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「日本旅遊基金」" className={fieldInputClass} />
      </Field>
      <Field label="圖示（輸入一個表情符號）">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label="目標金額">
        <input type="number" min={1} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className={fieldInputClass} />
      </Field>
      {!isEdit && (
        <Field label="目前已經存了多少（可不填，預設 0）">
          <input type="number" min={0} value={currentAmount} onChange={(e) => setCurrentAmount(e.target.value)} className={fieldInputClass} />
        </Field>
      )}
      <Field label="目標日期（可不填）">
        <DateField value={targetDate} onChange={setTargetDate} placeholder="不設期限" />
      </Field>
    </Modal>
  );
}

export function ContributeModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  const amountNum = Number(amount);
  const canSave = Number.isFinite(amountNum) && amountNum > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="存入"
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button disabled={!canSave} onClick={() => onSave(amountNum)}>
              確認存入
            </Button>
          </div>
        </>
      }
    >
      <Field label="這次要存入多少">
        <input type="number" min={1} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
      </Field>
    </Modal>
  );
}
