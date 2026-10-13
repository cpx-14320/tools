"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { categoryFillClass, type CategoryColor, type CategoryKind } from "@/lib/expenses/categories";

const COLORS: CategoryColor[] = ["a", "b", "c", "d", "e", "f"];

export interface CategoryModalDraft {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
}

export function CategoryModal({
  open,
  isSubcategory,
  parentName,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** 子分類不能自己選顏色／收支類型，跟父分類一致。 */
  isSubcategory: boolean;
  parentName?: string;
  initial?: CategoryModalDraft;
  onClose: () => void;
  onSave: (draft: Pick<CategoryModalDraft, "name" | "icon"> & Partial<Pick<CategoryModalDraft, "color" | "kind">>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🏷️");
  const [color, setColor] = useState<CategoryColor>(initial?.color ?? "a");
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "支出");

  const title = initial ? "編輯分類" : isSubcategory ? `新增「${parentName}」的子分類` : "新增分類";
  const canSave = name.trim().length > 0 && icon.trim().length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
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
              onClick={() => onSave(isSubcategory ? { name: name.trim(), icon: icon.trim() } : { name: name.trim(), icon: icon.trim(), color, kind })}
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「餐飲」" className={fieldInputClass} />
      </Field>
      <Field label="圖示（輸入一個表情符號）">
        <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldInputClass} />
      </Field>

      {!isSubcategory && (
        <>
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
          <Field label="顏色">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`顏色 ${c}`}
                  onClick={() => setColor(c)}
                  className={`size-8 rounded-full ${categoryFillClass[c]} ${color === c ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
                />
              ))}
            </div>
          </Field>
        </>
      )}
    </Modal>
  );
}
