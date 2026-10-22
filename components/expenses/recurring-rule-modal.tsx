"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { CategoryGridPicker } from "./category-grid-picker";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { CategoryBatchModal, type CategoryBatchItem } from "./category-batch-modal";
import { categoryPath, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
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
 *  （同一個 CategoryGridPicker、同一個分類清單），差別只在於這裡多了頻率／循環次數／
 *  開始日期這組「排程」欄位。 */
export function RecurringRuleModal({
  open,
  categories,
  goals,
  defaultKind,
  initial,
  onClose,
  onSave,
  onDelete,
  onCategoriesChange,
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
  /** 分類格子裡「＋新增」當場建好新分類後，把最新的分類清單回報給呼叫端更新自己的
   *  categories 狀態。 */
  onCategoriesChange: (categories: CategoryDTO[]) => void;
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
  const [categoryBatchOpen, setCategoryBatchOpen] = useState(false);

  const amountNum = evaluateExpr(amount);
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

  // 逐筆依序 POST，理由跟新增交易彈窗的「＋新增」分類一樣：新分類的 order 是用當下已
  // 存在筆數算出來的，併發送出會拿到同一個 order。建好之後直接選進這條規則。
  async function handleCreateCategories(items: CategoryBatchItem[]) {
    let latest = categories;
    let firstNewId: string | undefined;
    for (const item of items) {
      const data: { category?: CategoryDTO; categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) {
        latest = data.categories;
        if (!firstNewId && data.category) firstNewId = data.category.id;
      }
    }
    onCategoriesChange(latest);
    if (firstNewId) setCategoryId(firstNewId);
    setCategoryBatchOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯固定收支" : "新增固定收支"}
      fullHeight
      stickyBottom={<AmountKeypad expr={amount} onExprChange={setAmount} label="每次金額" />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
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
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9C94C4]">分類</span>
          {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
        </div>
        <CategoryGridPicker
          categories={categories}
          kind={kind}
          value={categoryId}
          onChange={setCategoryId}
          onAddClick={() => setCategoryBatchOpen(true)}
          maxHeightClass="max-h-[200px]"
        />
      </div>


      <Field label="頻率">
        <SegmentedControl className="self-start" value={frequencyUnit} onChange={setFrequencyUnit} options={FREQUENCY_OPTIONS} />
      </Field>
      <Field label="每隔幾個單位（例如每 2 週填 2）">
        <input type="number" min={1} value={interval} onChange={(e) => setInterval_(e.target.value)} className={fieldInputClass} />
      </Field>

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLinkedGoalId("")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                !linkedGoalId ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
              }`}
            >
              不連動目標
            </button>
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setLinkedGoalId(g.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  linkedGoalId === g.id ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
                }`}
              >
                {g.icon} {g.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <CategoryBatchModal
        open={categoryBatchOpen}
        isSubcategory={false}
        categories={categories}
        lockedKind={kind}
        onClose={() => setCategoryBatchOpen(false)}
        onSave={handleCreateCategories}
      />
    </Modal>
  );
}
