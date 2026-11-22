"use client";

import { useState } from "react";
import { EditorSheet } from "./editor-sheet";
import { Field, Hint, SelectButton, TextInput } from "./ui";
import { FaIcon } from "./fa-icon";
import { DEFAULT_GROUP_ICON, GROUP_ICONS, DISH_ICONS } from "./group-icons";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { colors, copy, text } from "./theme";
import { unitShort } from "@/lib/freshwise/price";
import type { BasketGroup } from "@/lib/freshwise/types";

/* ───────────────────── 分類（新增／編輯） ───────────────────── */

/** 新增或編輯一個分類（名稱＋圖示）。`group` 給值就是編輯、不給就是新增——兩種情況的
 *  欄位完全一樣，分成兩個彈窗只會有兩份一樣的表單要維護。 */
export function GroupEditorSheet({
  open,
  group,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** undefined＝新增。 */
  group?: BasketGroup;
  onClose: () => void;
  onSave: (name: string, icon: string) => void;
  /** 編輯既有分類時才給。 */
  onDelete?: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [icon, setIcon] = useState(group?.icon ?? DEFAULT_GROUP_ICON);

  // 每次打開都重設成目前這個分類的值（理由同 MarketPickerModal 的說明）。
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(group?.name ?? "");
      setIcon(group?.icon ?? DEFAULT_GROUP_ICON);
    }
  }

  return (
    <EditorSheet
      open={open}
      title={group ? `編輯${copy.group}` : `新增${copy.group}`}
      onClose={onClose}
      onSave={() => onSave(name, icon)}
      // 名稱是空白時不讓儲存：沒有名字的分類在清單上會是一片空白，使用者分不出是哪一個。
      saveDisabled={name.trim().length === 0}
      onDelete={onDelete}
      deleteLabel={`刪除${copy.group}`}
    >
      <Field label={`${copy.group}名稱`}>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：每週常買、鳳梨蝦球" maxLength={12} />
      </Field>

      <Field label="圖示" as="div">
        <div className="grid grid-cols-6 gap-2">
          {GROUP_ICONS.map((candidate) => {
            const active = candidate === icon;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setIcon(candidate)}
                aria-label={`選擇圖示 ${candidate}`}
                className="grid aspect-square place-items-center rounded-xl border transition-colors"
                // 底色跟同一個彈窗裡的「分類名稱」輸入框一樣（--fw-paper-sunk），
                // 兩個欄位並排時才像同一張表單，而不是一白一米。
                style={{
                  borderColor: active ? "var(--fw-leaf-line)" : "var(--fw-line-field)",
                  backgroundColor: active ? "var(--fw-leaf-soft)" : "var(--fw-paper-sunk)",
                }}
              >
                <FaIcon icon={candidate} size={40} color={active ? colors.brand : colors.faint} />
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="常見料理" as="div">
        <div className="fw-dish-options">
          {DISH_ICONS.map((dish) => {
            const active = icon === dish.icon;
            return (
              <button key={dish.icon} type="button" className="fw-dish-option" aria-label={`選擇料理圖示 ${dish.name}`} aria-pressed={active}
                onClick={() => {
                  const previous = DISH_ICONS.find((option) => option.icon === icon);
                  if (!name.trim() || name === previous?.name) setName(dish.name);
                  setIcon(dish.icon);
                }}>
                <FaIcon icon={dish.icon} size={48} />
                <span>{dish.name}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {onDelete && <Hint>刪除分類會把裡面的項目一起移除。</Hint>}
    </EditorSheet>
  );
}

/* ───────────────────── 項目（編輯數量／搬分類） ───────────────────── */

/**
 * 編輯菜籃裡的一個項目：常買的份量，以及要放在哪個分類。
 *
 * 份量是選填的。填了就能算出「這一籃今天大概要花多少錢」，不填就只追蹤價格——不要逼
 * 使用者填一個他其實沒概念的數字，那個數字一填下去就會被當成精算的依據。
 */
export function EntryEditorSheet({
  open,
  itemName,
  qtyCatty,
  groupId,
  groups,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  itemName: string;
  qtyCatty: number | null;
  groupId: string;
  groups: BasketGroup[];
  onClose: () => void;
  onSave: (qtyCatty: number | null, groupId: string) => void;
  onDelete: () => void;
}) {
  // 數量用字串存，不用 number：輸入框打到一半（「1.」）在 number 型別裡是 NaN，會讓
  // 游標跳掉或字被吃掉。按儲存時才解析。
  const [qtyText, setQtyText] = useState(qtyCatty === null ? "" : String(qtyCatty));
  const [pickedGroup, setPickedGroup] = useState(groupId);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setQtyText(qtyCatty === null ? "" : String(qtyCatty));
      setPickedGroup(groupId);
    }
  }

  const parsed = Number(qtyText.trim());
  const qtyValid = qtyText.trim() === "" || (Number.isFinite(parsed) && parsed > 0 && parsed <= 99);

  function save() {
    if (!qtyValid) return;
    onSave(qtyText.trim() === "" ? null : Math.round(parsed * 10) / 10, pickedGroup);
  }

  return (
    <>
      <EditorSheet
        open={open}
        title={itemName}
        description={`常買的份量填了之後，${copy.basket}就會估算這一籃大概要花多少錢。`}
        onClose={onClose}
        onSave={save}
        saveDisabled={!qtyValid}
        onDelete={onDelete}
        deleteLabel={`從${copy.basket}移除`}
      >
        <Field label={`常買份量（${unitShort("catty")}，可不填）`}>
          <TextInput
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value)}
            placeholder="例如：2"
            inputMode="decimal"
            // 原生的 type="number" 會在手機上帶出上下箭頭、也會自己擋掉半形以外的字元，
            // 跟這個 App 其他欄位的外觀不一致，所以用文字欄位＋inputMode 叫出數字鍵盤。
            type="text"
          />
        </Field>
        {!qtyValid && <Hint>份量請填 0 到 99 之間的數字。</Hint>}

        <Field label={copy.group} as="div">
          <SelectButton
            icon="folder"
            value={groups.find((g) => g.id === pickedGroup)?.name}
            placeholder={`選擇${copy.group}`}
            onClick={() => setGroupPickerOpen(true)}
          />
        </Field>
      </EditorSheet>

      {/* 分類選擇疊在編輯彈窗上面。後開的彈窗因為 DOM 掛載順序比較晚，自然疊在上面，
          不需要調 z-index（兩個都是 portal 到 body 的 fixed 元素）。 */}
      <BottomSheetModal
        open={groupPickerOpen}
        title={`選擇${copy.group}`}
        onClose={() => setGroupPickerOpen(false)}
        bodyClassName="flex flex-col px-2 py-2"
      >
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => {
              setPickedGroup(group.id);
              setGroupPickerOpen(false);
            }}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[#FCF7EB]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: colors.surfaceSoft }}>
              <FaIcon icon={group.icon} size={14} color={colors.brand} />
            </span>
            <span className={`min-w-0 flex-1 truncate ${text.body}`}>{group.name}</span>
            {group.id === pickedGroup && <FaIcon icon="check" size={13} color={colors.brand} />}
          </button>
        ))}
      </BottomSheetModal>
    </>
  );
}
