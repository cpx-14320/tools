"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { BatchDraftList } from "./batch-draft-list";
import { AccountIconPicker, CategoryColorPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { accountTypeNameTaken, DEFAULT_ACCOUNT_TYPE_COLOR, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import type { CategoryColor } from "@/lib/expenses/categories";

interface Draft {
  name: string;
  icon: string;
  kind: AccountKind;
  color: CategoryColor;
}

function blankDraft(kind: AccountKind = "asset"): Draft {
  return { name: "", icon: DEFAULT_PICKER_ICON, kind, color: DEFAULT_ACCOUNT_TYPE_COLOR };
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
  lockedKind,
}: {
  open: boolean;
  onClose: () => void;
  /** 只會收到名稱與圖示都有填、且名稱沒有撞名的草稿。 */
  onSave: (items: AccountTypeBatchItem[]) => void;
  /** 現有的所有帳戶類型，用來擋同一種資產/負債底下名稱重複。 */
  accountTypes: AccountTypeDTO[];
  /** 從資產總表的「資產」/「負債」小標題點新增時，開啟時直接預選對應的類型。
   *  有 lockedKind 時這個只是初始值，實際上每一則都會被鎖定成 lockedKind。 */
  defaultKind?: AccountKind;
  /** 從「新增帳戶」彈窗裡點「＋新增」時傳進來——那裡已經先選好資產/負債的分頁，
   *  這裡就不用重複問一次，直接鎖定同一種、不顯示類型切換。 */
  lockedKind?: AccountKind;
}) {
  const effectiveKind = lockedKind ?? defaultKind;
  const [items, setItems] = useState<Draft[]>([blankDraft(effectiveKind)]);

  // 每次重新打開都重設成對應 kind 的單一空白草稿——不然從「負債」點新增，拿到的卻是
  // 上一次（可能是「資產」那次）留下的草稿內容。
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

  const canSave = items.some((it, i) => it.name.trim() && it.icon.trim() && !isDuplicateDraft(items, i, accountTypes));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增帳戶類型"
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave(
              items
                .map((it, i) => ({ ...it, name: it.name.trim(), icon: it.icon.trim(), _dup: isDuplicateDraft(items, i, accountTypes) }))
                .filter((it) => it.name && it.icon && !it._dup)
                .map(({ name, icon, kind, color }) => ({ name, icon, kind, color })),
            )
          }
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
            {/* 欄位順序跟消費分類的彈窗一致：類型→名稱→圖示→顏色。
                鎖定 kind 時（從「新增帳戶」彈窗裡開啟）不給切換——資產/負債在上一層已經
                選過了，這裡再問一次就會出現「畫面停在負債分頁，卻建出一個資產類型」這種
                對不起來的結果。但還是要寫出來是哪一種：少了這一行，建出來的東西是資產
                還是負債只能靠「我剛剛點的是哪個分頁」用記的，看不到任何提示。 */}
            {lockedKind ? (
              i === 0 && (
                <Field label="類型">
                  <p className="text-sm font-medium text-[#4A3B7C]">
                    {lockedKind === "asset" ? "資產" : "負債"}
                    <span className="ml-2 text-xs font-normal text-[#9C94C4]">跟著上一層選的分頁，這裡不能改</span>
                  </p>
                </Field>
              )
            ) : (
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
            )}
            <Field label="名稱">
              <input value={item.name} onChange={(e) => updateItem(i, { name: e.target.value })} placeholder="例如「定存」" className={fieldInputClass} />
            </Field>
            {isDuplicateDraft(items, i, accountTypes) && (
              <p className="text-xs text-[#D1517E]">已經有同樣名稱的{item.kind === "asset" ? "資產" : "負債"}類型了，換一個名稱吧。</p>
            )}
            <AccountIconPicker value={item.icon} onChange={(icon) => updateItem(i, { icon })} />
            <CategoryColorPicker value={item.color} onChange={(color) => updateItem(i, { color })} />
          </>
        )}
      />
    </Modal>
  );
}
