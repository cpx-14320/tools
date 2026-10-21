"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { BatchDraftList } from "./batch-draft-list";
import { CategoryColorPicker, CategoryIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { categoryNameTaken, type CategoryColor, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

interface Draft {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
}

function blankDraft(kind: CategoryKind = "支出"): Draft {
  return { name: "", icon: DEFAULT_PICKER_ICON, color: "a", kind };
}

export type CategoryBatchItem = Pick<Draft, "name" | "icon"> & Partial<Pick<Draft, "color" | "kind">>;

// 同一個父分類底下（或同一種收支類型的頂層）名稱不能重複——跟已存在的分類撞名，或這一批
// 草稿裡自己人互撞都算。
function isDuplicateDraft(items: Draft[], index: number, existing: CategoryDTO[], parentId: string | undefined): boolean {
  const item = items[index];
  const name = item.name.trim();
  if (!name) return false;
  if (categoryNameTaken(existing, name, { kind: item.kind, parentId })) return true;
  return items.some((other, i) => i !== index && other.kind === item.kind && other.name.trim() === name);
}

/** 新增分類／子分類——跟搭乘車「新增分類」同一種做法：一次開著好幾則草稿一起填，填完
 *  按一次「儲存」整批送出。子分類不能自己選
 *  顏色／收支類型（跟父分類一致，見 category-modal.tsx 的同樣規則），所以 isSubcategory
 *  時每一則只會顯示名稱／圖示兩個欄位，color/kind 不會出現在 onSave 回傳的物件裡，由
 *  呼叫端補上父分類的值。 */
export function CategoryBatchModal({
  open,
  isSubcategory,
  parentId,
  categories,
  defaultKind = "支出",
  lockedKind,
  onClose,
  onSave,
}: {
  open: boolean;
  isSubcategory: boolean;
  /** 子分類時用來圈定「同一個父分類底下」的名稱重複檢查範圍。 */
  parentId?: string;
  /** 現有的所有分類，用來擋名稱重複。 */
  categories: CategoryDTO[];
  /** 從新增交易彈窗點分類格子裡的「＋新增」開這個彈窗時，直接預選目前支出/收入分頁。
   *  有 lockedKind 時這個只是初始值，實際上每一則都會被鎖定成 lockedKind。 */
  defaultKind?: CategoryKind;
  /** 呼叫端已經決定好要建哪一種（例如從新增交易彈窗的「支出」分頁點進來）時傳這個——
   *  這裡就不再顯示收支類型切換，避免在支出分頁底下卻建出一個收入分類，兩邊對不起來。 */
  lockedKind?: CategoryKind;
  onClose: () => void;
  /** 只會收到名稱與圖示都有填、且名稱沒有撞名的草稿。 */
  onSave: (items: CategoryBatchItem[]) => void;
}) {
  const effectiveKind = lockedKind ?? defaultKind;
  const [items, setItems] = useState<Draft[]>([blankDraft(effectiveKind)]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (open) setItems([blankDraft(effectiveKind)]);
  }, [open, effectiveKind]);

  function updateItem(index: number, patch: Partial<Draft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  const canSave = items.some((it, i) => it.name.trim() && it.icon.trim() && !isDuplicateDraft(items, i, categories, parentId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSubcategory ? "新增子分類" : "新增分類"}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => {
            const valid = items
              .map((it, i) => ({ ...it, name: it.name.trim(), icon: it.icon.trim(), _dup: isDuplicateDraft(items, i, categories, parentId) }))
              .filter((it) => it.name && it.icon && !it._dup);
            onSave(
              isSubcategory
                ? valid.map(({ name, icon, color }) => ({ name, icon, color }))
                : valid.map(({ name, icon, color, kind }) => ({ name, icon, color, kind })),
            );
          }}
          confirmDisabled={!canSave}
        />
      }
    >
      <BatchDraftList
        items={items}
        onRemove={removeItem}
        onAdd={() => setItems((list) => [...list, blankDraft(effectiveKind)])}
        renderItem={(item, i) => (
          <>
            <Field label="名稱">
              <input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} className={fieldInputClass} />
            </Field>
            {isDuplicateDraft(items, i, categories, parentId) && <p className="text-xs text-[#D1517E]">已經有同樣名稱的分類了，換一個名稱吧。</p>}
            <CategoryIconPicker kind={item.kind} value={item.icon} onChange={(icon) => updateItem(i, { icon })} />

            {/* 收支類型只有頂層分類能選，而且呼叫端已經決定好（lockedKind）時也不用再問
                ——分頁上已經選過支出還是收入了，這裡再問一次只會建出對不上的分類。
                顏色則是子分類也能選，跟編輯分類彈窗的欄位保持一致。 */}
            {!isSubcategory && !lockedKind && (
              <Field label="收支類型">
                <SegmentedControl
                  className="self-start"
                  value={item.kind}
                  onChange={(kind) => updateItem(i, { kind })}
                  options={[
                    { value: "支出", label: "支出" },
                    { value: "收入", label: "收入" },
                  ]}
                />
              </Field>
            )}
            <CategoryColorPicker value={item.color} onChange={(color) => updateItem(i, { color })} />
          </>
        )}
      />
    </Modal>
  );
}
