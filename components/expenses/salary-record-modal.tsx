"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field } from "./modal";
import { DateField } from "./date-field";
import type { SalaryItemTypeDTO } from "@/lib/expenses/salary-types";
import type { SalaryRecordItem } from "@/lib/expenses/salary-records";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function SalaryRecordModal({
  open,
  types,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  types: SalaryItemTypeDTO[];
  initial?: { yearMonth: string; items: SalaryRecordItem[] };
  onClose: () => void;
  onSave: (yearMonth: string, items: SalaryRecordItem[]) => void;
  onDelete?: () => void;
}) {
  const [yearMonth, setYearMonth] = useState(initial?.yearMonth ?? currentYearMonth());
  const [items, setItems] = useState<SalaryRecordItem[]>(
    initial?.items ?? (types[0] ? [{ typeId: types[0].id, amount: 0 }] : []),
  );

  const validItems = items.filter((i) => i.typeId && i.amount > 0);
  const canSave = !!yearMonth && validItems.length > 0;

  function updateItem(index: number, patch: Partial<SalaryRecordItem>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    if (!types[0]) return;
    setItems([...items, { typeId: types[0].id, amount: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯薪資紀錄" : "新增薪資紀錄"}
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
            <Button disabled={!canSave} onClick={() => onSave(yearMonth, validItems)}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="月份">
        <DateField value={yearMonth} onChange={setYearMonth} granularity="month" disabled={!!initial} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[#9C94C4]">明細項目</span>
        {types.length === 0 ? (
          <p className="text-xs text-[#B3ABD4]">還沒有任何薪資明細類型，先到「薪資明細類型」頁新增。</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={item.typeId}
                onChange={(e) => updateItem(i, { typeId: e.target.value })}
                className="min-w-0 flex-1 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-2 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}（{t.kind}）
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={item.amount || ""}
                onChange={(e) => updateItem(i, { amount: Number(e.target.value) })}
                className="w-24 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-2 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
              <button type="button" onClick={() => removeItem(i)} aria-label="移除這個項目" className="shrink-0 text-[#9C94C4] hover:text-[#D1517E]">
                ✕
              </button>
            </div>
          ))
        )}
        {types.length > 0 && (
          <button type="button" onClick={addItem} className="self-start text-xs font-medium text-[#6F5FD6]">
            ＋ 新增一列
          </button>
        )}
      </div>
    </Modal>
  );
}
