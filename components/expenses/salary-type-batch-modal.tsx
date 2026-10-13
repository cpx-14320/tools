"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import type { SalaryItemKind } from "@/lib/expenses/salary-types";

interface Draft {
  name: string;
  kind: SalaryItemKind;
}

function blankDraft(): Draft {
  return { name: "", kind: "加項" };
}

/** 新增薪資明細類型——跟搭乘車「新增分類」（frequent-trip-modal.tsx）同一種做法：
 *  一次開著好幾則草稿一起填，填完按一次「儲存」整批送出，不用新增一則、存檔、
 *  再點新增、再存檔這樣分開跑好幾輪。只給「新增」用；編輯既有類型維持
 *  SalaryTypeModal 單則表單，改一筆存一筆的語意本來就跟批次新增不一樣。 */
export function SalaryTypeBatchModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** 只會收到名稱有填的草稿——存檔時自動濾掉沒填名稱的空白列，不用使用者自己先刪掉。 */
  onSave: (items: Draft[]) => void;
}) {
  const [items, setItems] = useState<Draft[]>([blankDraft()]);

  function updateItem(index: number, patch: Partial<Draft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  const canSave = items.some((it) => it.name.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增薪資明細類型"
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
                const valid = items.map((it) => ({ ...it, name: it.name.trim() })).filter((it) => it.name);
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
            <input
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="例如「本薪」「獎金」"
              className={fieldInputClass}
            />
          </Field>
          <Field label="類型">
            <SegmentedControl
              className="self-start"
              value={item.kind}
              onChange={(kind) => updateItem(i, { kind })}
              options={[
                { value: "加項", label: "加項" },
                { value: "扣項", label: "扣項" },
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
