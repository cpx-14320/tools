"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";
import { topLevelCategories, subCategoriesOf, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TransactionModalDraft {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
}

export function TransactionModal({
  open,
  categories,
  defaultKind,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  categories: CategoryDTO[];
  defaultKind: CategoryKind;
  initial?: TransactionModalDraft;
  onClose: () => void;
  onSave: (draft: TransactionModalDraft) => void;
  onDelete?: () => void;
}) {
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [kind, setKind] = useState<CategoryKind>(initialCategory?.kind ?? defaultKind);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");

  const amountNum = Number(amount);
  const canSave = categoryId && Number.isFinite(amountNum) && amountNum > 0 && date;

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
      title={initial ? "編輯消費紀錄" : "新增消費紀錄"}
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
              onClick={() => onSave({ categoryId, amount: amountNum, date, note: note.trim() || undefined })}
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
      <Field label="金額">
        <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label="日期">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="備註（可不填）">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>
    </Modal>
  );
}
