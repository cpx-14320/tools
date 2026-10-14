"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import type { AccountKind } from "@/lib/expenses/account-types";

interface Draft {
  name: string;
  icon: string;
  kind: AccountKind;
}

function blankDraft(): Draft {
  return { name: "", icon: "🏷️", kind: "asset" };
}

export type AccountTypeBatchItem = Draft;

/** 新增帳戶類型——跟分類「新增分類」同一種做法：一次開著好幾則草稿一起填，填完按
 *  一次「儲存」整批送出（見 category-batch-modal.tsx）。 */
export function AccountTypeBatchModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** 只會收到名稱與圖示都有填的草稿。 */
  onSave: (items: AccountTypeBatchItem[]) => void;
}) {
  const [items, setItems] = useState<Draft[]>([blankDraft()]);

  function updateItem(index: number, patch: Partial<Draft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  const canSave = items.some((it) => it.name.trim() && it.icon.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增帳戶類型"
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                const valid = items.map((it) => ({ ...it, name: it.name.trim(), icon: it.icon.trim() })).filter((it) => it.name && it.icon);
                onSave(valid);
              }}
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#ECE4FA] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9C94C4]">第 {i + 1} 則</span>
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} className="text-xs font-medium text-[#D1517E]">
                刪除
              </button>
            )}
          </div>
          <Field label="名稱">
            <input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="例如「定存」" className={fieldInputClass} />
          </Field>
          <Field label="圖示（輸入一個表情符號）">
            <input value={item.icon} onChange={(e) => updateItem(i, { icon: e.target.value })} className={fieldInputClass} />
          </Field>
          <Field label="類型">
            <SegmentedControl
              className="self-start"
              value={item.kind}
              onChange={(kind) => updateItem(i, { kind })}
              options={[
                { value: "asset", label: "資產" },
                { value: "liability", label: "負債" },
              ]}
            />
          </Field>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setItems((list) => [...list, blankDraft()])}
        className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
      >
        ＋ 新增一則
      </button>
    </Modal>
  );
}
