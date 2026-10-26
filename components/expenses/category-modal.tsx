"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { SelectField } from "./select-field";
import { CategoryColorPicker, CategoryIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { AccountPickerModal } from "./account-picker-modal";
import { categoryNameTaken, type CategoryColor, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";

export interface CategoryModalDraft {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
  /** 預設帳戶（只有頂層分類有）——空字串＝不指定。 */
  defaultAccountId?: string;
}

export function CategoryModal({
  open,
  isSubcategory,
  parentId,
  categories,
  accounts,
  accountTypes,
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
  /** 可以當預設帳戶的帳戶清單；空陣列（還沒建任何帳戶）就不顯示那一欄。 */
  accounts: AccountDTO[];
  /** 帳戶選擇彈窗用來分資產／負債兩組、並取得每個帳戶的類型圖示。 */
  accountTypes: AccountTypeDTO[];
  /** 編輯既有分類時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  initial?: CategoryModalDraft;
  onClose: () => void;
  /** 子分類只會回傳名稱——圖示／顏色／收支類型都跟著父分類，不由這個彈窗決定。 */
  onSave: (
    draft: Pick<CategoryModalDraft, "name"> & Partial<Pick<CategoryModalDraft, "icon" | "color" | "kind" | "defaultAccountId">>,
  ) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  const [color, setColor] = useState<CategoryColor>(initial?.color ?? "a");
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? "支出");
  const [defaultAccountId, setDefaultAccountId] = useState(initial?.defaultAccountId ?? "");
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === defaultAccountId);
  const title = initial ? "編輯分類" : isSubcategory ? "新增子分類" : "新增分類";
  const isDuplicate = categoryNameTaken(categories, name, { kind, parentId }, excludeId);
  // 子分類只填名稱，圖示由父分類決定，不能拿它當必填條件。
  const canSave = name.trim().length > 0 && (isSubcategory || icon.trim().length > 0) && !isDuplicate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave(
              isSubcategory ? { name: name.trim() } : { name: name.trim(), icon: icon.trim(), color, kind, defaultAccountId },
            )
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 欄位順序：類型→名稱→圖示→顏色，跟帳戶類型的彈窗一致。子分類只剩名稱——收支
          類型、圖示、顏色全都跟著父分類走（見 categories.server.ts 的 createCategory），
          留著那兩個選擇器只是讓人選了卻不會生效。 */}
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

      {!isSubcategory && (
        <>
          <CategoryIconPicker kind={kind} value={icon} onChange={setIcon} />
          <CategoryColorPicker value={color} onChange={setColor} />
          {/* 預設帳戶：記一筆選到這個分類時，帳戶欄自動帶上它，省掉每筆都要挑一次。
              只設在頂層分類——子分類是它底下的細項，錢從哪個帳戶出通常一樣（見
              categories.ts 的 defaultAccountForCategory）。還沒建任何帳戶就不顯示。 */}
          {accounts.length > 0 && (
            <Field label="預設帳戶（可不填）">
              {/* 跟新增消費紀錄挑帳戶用同一個 AccountPickerModal，不用原生 <select>：
                  原生選單在手機上是作業系統自己的滾輪，樣式跟整個記帳本格格不入，而且
                  只剩一行純文字，看不到帳戶的類型圖示、也分不出資產還負債。 */}
              <SelectField value={selectedAccount?.name} placeholder="不指定" onClick={() => setAccountPickerOpen(true)} />
            </Field>
          )}
        </>
      )}
      {/* 每月預算已經搬到獨立的「預算設定」頁（可以按月份分別設定），不在這裡輸入。 */}

      {/* 這裡選的是「這個分類平常從哪個帳戶出」，跟帳戶當下剩多少錢無關，所以不顯示餘額
          （showBalance）——顯示的話這一頁就得為了一行數字再去撈全部交易跟轉帳。 */}
      <AccountPickerModal
        open={accountPickerOpen}
        title="選擇預設帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        showBalance={false}
        unsetLabel="不指定"
        value={defaultAccountId || undefined}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={(id) => setDefaultAccountId(id ?? "")}
      />
    </Modal>
  );
}
