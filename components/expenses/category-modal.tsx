"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { CategoryColorPicker, CategoryIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { categoryNameTaken, type CategoryColor, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

export interface CategoryModalDraft {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
}

export function CategoryModal({
  open,
  isSubcategory,
  parentId,
  categories,
  excludeId,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** 子分類不能自己選顏色／收支類型，跟父分類一致。 */
  isSubcategory: boolean;
  /** 子分類時用來圈定「同一個父分類底下」的名稱重複檢查範圍。 */
  parentId?: string;
  /** 現有的所有分類，用來擋同一個父分類（或同一種收支類型的頂層）底下名稱重複。 */
  categories: CategoryDTO[];
  /** 編輯既有分類時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  initial?: CategoryModalDraft;
  onClose: () => void;
  onSave: (draft: Pick<CategoryModalDraft, "name" | "icon"> & Partial<Pick<CategoryModalDraft, "color" | "kind">>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  const [color, setColor] = useState<CategoryColor>(initial?.color ?? "a");
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "支出");

  const title = initial ? "編輯分類" : isSubcategory ? "新增子分類" : "新增分類";
  const isDuplicate = categoryNameTaken(categories, name, { kind, parentId }, excludeId);
  const canSave = name.trim().length > 0 && icon.trim().length > 0 && !isDuplicate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave(isSubcategory ? { name: name.trim(), icon: icon.trim(), color } : { name: name.trim(), icon: icon.trim(), color, kind })
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 欄位順序：類型→名稱→圖示→顏色，跟帳戶類型的彈窗一致。收支類型只有頂層分類
          能選（子分類一定跟著父分類走）；顏色則是兩種都能選，新增跟編輯看到的欄位才
          會一致。 */}
      {!isSubcategory && (
        <Field label="收支類型">
          <SegmentedControl
            className="self-start"
            value={kind}
            onChange={setKind}
            options={[
              { value: "支出", label: "支出" },
              { value: "收入", label: "收入" },
            ]}
          />
        </Field>
      )}
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
      </Field>
      {isDuplicate && <p className="text-xs text-[#D1517E]">已經有同樣名稱的分類了，換一個名稱吧。</p>}

      <CategoryIconPicker kind={kind} value={icon} onChange={setIcon} />
      <CategoryColorPicker value={color} onChange={setColor} />
      {/* 每月預算已經搬到獨立的「預算設定」頁（可以按月份分別設定），不在這裡輸入。 */}
    </Modal>
  );
}
