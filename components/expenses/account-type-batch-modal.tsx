"use client";

import { useEffect, useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { accountTypeNameTaken, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";

interface Draft {
  name: string;
  icon: string;
  kind: AccountKind;
}

function blankDraft(kind: AccountKind = "asset"): Draft {
  return { name: "", icon: "🏷️", kind };
}

export type AccountTypeBatchItem = Draft;

// 同一種資產/負債底下名稱不能重複——跟已存在的類型撞名，或這一批草稿裡自己人互撞都算。
function isDuplicateDraft(items: Draft[], index: number, existing: AccountTypeDTO[]): boolean {
  const item = items[index];
  const name = item.name.trim();
  if (!name) return false;
  if (accountTypeNameTaken(existing, item.kind, name)) return true;
  return items.some((other, i) => i !== index && other.kind === item.kind && other.name.trim() === name);
}

/** 新增帳戶類型——跟分類「新增分類」同一種做法：一次開著好幾則草稿一起填，填完按
 *  一次「儲存」整批送出（見 category-batch-modal.tsx）。 */
export function AccountTypeBatchModal({
  open,
  onClose,
  onSave,
  accountTypes,
  defaultKind = "asset",
}: {
  open: boolean;
  onClose: () => void;
  /** 只會收到名稱與圖示都有填、且名稱沒有撞名的草稿。 */
  onSave: (items: AccountTypeBatchItem[]) => void;
  /** 現有的所有帳戶類型，用來擋同一種資產/負債底下名稱重複。 */
  accountTypes: AccountTypeDTO[];
  /** 從資產總表的「資產」/「負債」小標題點新增時，開啟時直接預選對應的類型。 */
  defaultKind?: AccountKind;
}) {
  const [items, setItems] = useState<Draft[]>([blankDraft(defaultKind)]);

  // 每次重新打開都重設成對應 kind 的單一空白草稿——不然從「負債」點新增，拿到的卻是
  // 上一次（可能是「資產」那次）留下的草稿內容。
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (open) setItems([blankDraft(defaultKind)]);
  }, [open, defaultKind]);

  function updateItem(index: number, patch: Partial<Draft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  const canSave = items.some((it, i) => it.name.trim() && it.icon.trim() && !isDuplicateDraft(items, i, accountTypes));

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
                const valid = items
                  .map((it, i) => ({ ...it, name: it.name.trim(), icon: it.icon.trim(), _dup: isDuplicateDraft(items, i, accountTypes) }))
                  .filter((it) => it.name && it.icon && !it._dup)
                  .map(({ name, icon, kind }) => ({ name, icon, kind }));
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
          {isDuplicateDraft(items, i, accountTypes) && (
            <p className="text-xs text-[#D1517E]">已經有同樣名稱的{item.kind === "asset" ? "資產" : "負債"}類型了，換一個名稱吧。</p>
          )}
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
