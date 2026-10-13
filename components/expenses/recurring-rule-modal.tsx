"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";
import { topLevelCategories, subCategoriesOf, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import type { RecurrenceFrequencyUnit } from "@/lib/expenses/recurring-rules";
import type { SavingsGoalDTO } from "@/lib/expenses/goals";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface RecurringRuleModalDraft {
  categoryId: string;
  amount: number;
  note?: string;
  frequencyUnit: RecurrenceFrequencyUnit;
  interval: number;
  startDate: string;
  cycleCount?: number;
  linkedGoalId?: string;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequencyUnit; label: string }[] = [
  { value: "day", label: "每天" },
  { value: "week", label: "每週" },
  { value: "month", label: "每月" },
];

/** 新增／編輯固定收支規則——跟 TransactionModal 共用「收支類型→分類」的篩選邏輯
 *  （同一個分類清單、同一套 topLevelCategories／subCategoriesOf 用法），差別只在於
 *  這裡多了頻率／循環次數／開始日期這組「排程」欄位。 */
export function RecurringRuleModal({
  open,
  categories,
  goals,
  defaultKind,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  categories: CategoryDTO[];
  /** 只有分類是「收入」時才會顯示「同時存入目標」選項，所以需要目標清單。 */
  goals: SavingsGoalDTO[];
  defaultKind: CategoryKind;
  initial?: RecurringRuleModalDraft;
  onClose: () => void;
  onSave: (draft: RecurringRuleModalDraft) => void;
  onDelete?: () => void;
}) {
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [kind, setKind] = useState<CategoryKind>(initialCategory?.kind ?? defaultKind);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [frequencyUnit, setFrequencyUnit] = useState<RecurrenceFrequencyUnit>(initial?.frequencyUnit ?? "month");
  const [interval, setInterval_] = useState(initial ? String(initial.interval) : "1");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [cycleCount, setCycleCount] = useState(initial?.cycleCount ? String(initial.cycleCount) : "");
  const [linkedGoalId, setLinkedGoalId] = useState(initial?.linkedGoalId ?? "");

  const amountNum = Number(amount);
  const intervalNum = Number(interval);
  const cycleCountNum = cycleCount.trim() ? Number(cycleCount) : undefined;
  const canSave =
    categoryId &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    Number.isFinite(intervalNum) &&
    intervalNum >= 1 &&
    startDate &&
    (cycleCountNum === undefined || (Number.isFinite(cycleCountNum) && cycleCountNum > 0));

  const options: { id: string; label: string }[] = [];
  for (const parent of topLevelCategories(categories, kind)) {
    options.push({ id: parent.id, label: `${parent.icon} ${parent.name}` });
    for (const sub of subCategoriesOf(categories, parent.id)) {
      options.push({ id: sub.id, label: `　↳ ${sub.icon} ${sub.name}` });
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯固定收支" : "新增固定收支"}
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
                  categoryId,
                  amount: amountNum,
                  note: note.trim() || undefined,
                  frequencyUnit,
                  interval: Math.floor(intervalNum),
                  startDate,
                  cycleCount: cycleCountNum,
                  linkedGoalId: kind === "收入" && linkedGoalId ? linkedGoalId : undefined,
                })
              }
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="收支類型">
        <SegmentedControl
          className="self-start"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setCategoryId("");
          }}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
      </Field>
      <Field label="分類">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldInputClass}>
          <option value="" disabled>
            選擇分類
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="每次金額">
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="頻率">
          <SegmentedControl value={frequencyUnit} onChange={setFrequencyUnit} options={FREQUENCY_OPTIONS} />
        </Field>
        <Field label="每隔幾個單位（例如每 2 週填 2）">
          <input type="number" min={1} value={interval} onChange={(e) => setInterval_(e.target.value)} className={fieldInputClass} />
        </Field>
      </div>

      <Field label="開始日期">
        <DateField value={startDate} onChange={setStartDate} />
      </Field>
      <Field label="循環次數（留空＝無限期循環，例如房租）">
        <input
          type="number"
          min={1}
          placeholder="留空＝無限期"
          value={cycleCount}
          onChange={(e) => setCycleCount(e.target.value)}
          className={fieldInputClass}
        />
      </Field>
      <Field label="備註（可不填，例如「手機月租・綁約 2 年」）">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>

      {kind === "收入" && goals.length > 0 && (
        <Field label="同時存入目標（可不填）——「週期存錢」就是在這裡選一個目標">
          <select value={linkedGoalId} onChange={(e) => setLinkedGoalId(e.target.value)} className={fieldInputClass}>
            <option value="">不連動目標</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.name}
              </option>
            ))}
          </select>
        </Field>
      )}
    </Modal>
  );
}
