"use client";

import { useState } from "react";
import { ImageSlot } from "./image-slot";
import { MEMO_ICON_OPTIONS } from "./memo-icons";
import { DatePickerModal } from "./date-picker-modal";
import { TimePickerModal } from "./time-picker-modal";
import { EditorSheet } from "./editor-sheet";
import { AddButton, DangerButton, DragHandle, EditorItemCard, EditorItemHeader, Field, FieldRow, SelectButton, TextArea } from "./ui";
import { copy } from "./theme";
import { moveItem, useDragReorder } from "./use-drag-reorder";

export interface MemoDraft {
  id?: string;
  content: string;
  icon: string;
  remindAt: string; // datetime-local 輸入框的格式（本地時間，沒有時區），空字串＝沒填
}

export interface MemoInitial {
  id: string;
  content: string;
  icon: string;
  remindAt: string | null; // ISO 字串（UTC）
}

// datetime-local 要的格式是 "YYYY-MM-DDTHH:mm"（本地時間，不帶時區）。用 Date 的
// getFullYear/getHours 等 getter 讀，這些 getter 回傳的本來就是瀏覽器所在時區的本地值，
// 不用自己換算時區。
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// remindAt 是 "YYYY-MM-DDTHH:mm" 存成一個字串，但日期／時間要分開兩個彈窗選，這裡拆開來
// 給每個彈窗自己的 initial 值用；拆不出來（還沒填過）就各自退回「今天」「09:00」。
function splitRemindAt(value: string): { date: string; time: string } {
  const [date, time] = value.split("T");
  return { date: date || todayLocal(), time: time || "09:00" };
}

function blankDraft(): MemoDraft {
  return { content: "", icon: MEMO_ICON_OPTIONS[0].key, remindAt: "" };
}

export function MemoEditorModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: MemoInitial[];
  onClose: () => void;
  onSave: (items: MemoDraft[]) => void;
}) {
  const [items, setItems] = useState<MemoDraft[]>(
    initial.length > 0
      ? initial.map((m) => ({ id: m.id, content: m.content, icon: m.icon, remindAt: toDatetimeLocal(m.remindAt) }))
      : [blankDraft()],
  );
  // 跟「編輯分類」的行程清單同一套做法：日期／時間共用同一顆彈窗元件，用 {index, field}
  // 記住現在是在幫第幾則的哪個欄位選值，不用每一則各自配一組彈窗狀態。
  const [editTarget, setEditTarget] = useState<{ index: number; field: "date" | "time" } | null>(null);
  // 備忘錄的顯示順序就是這份清單的順序（存檔時 order 照索引寫回，見 lib/transit/memos.ts），
  // 所以拖曳排序只要改這個陣列、按儲存就生效，不用另外一支排序 API。
  const drag = useDragReorder(
    items.length,
    (from, to) => setItems((list) => moveItem(list, from, to)),
    () => {},
  );

  function updateItem(index: number, patch: Partial<MemoDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => list.filter((_, i) => i !== index));
  }

  const editing = editTarget ? splitRemindAt(items[editTarget.index].remindAt) : null;

  return (
    <EditorSheet
      open={open}
      title={`編輯${copy.memo}`}
      description="可以按住左邊的握把拖曳調整顯示順序。"
      onClose={onClose}
      onSave={() => onSave(items.filter((it) => it.content.trim()))}
    >
      {items.map((item, i) => {
        const { date: pickedDate, time: pickedTime } = splitRemindAt(item.remindAt);
        return (
          <div key={i} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
            <EditorItemCard>
              <EditorItemHeader
                index={i}
                unit="則"
                onDelete={() => removeItem(i)}
                dragHandle={<DragHandle label={`拖曳排序 第 ${i + 1} 則${copy.memo}`} {...drag.handleProps(i)} />}
              />

              <div className="flex flex-wrap items-center gap-2">
                {MEMO_ICON_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateItem(i, { icon: option.key })}
                    aria-label={`選擇圖示 ${option.key}`}
                    className={item.icon === option.key ? "" : "opacity-50"}
                  >
                    <ImageSlot src={option.icon} alt={option.key} className="size-8 rounded-lg" />
                  </button>
                ))}
              </div>

              <TextArea placeholder="內容" value={item.content} onChange={(e) => updateItem(i, { content: e.target.value })} rows={2} />

              <Field
                as="div"
                label="提醒時間（選填）"
                action={item.remindAt ? <DangerButton onClick={() => updateItem(i, { remindAt: "" })}>清除</DangerButton> : undefined}
              >
                <FieldRow>
                  <SelectButton
                    chevron={false}
                    value={item.remindAt ? pickedDate.replaceAll("-", "/") : ""}
                    placeholder="選擇日期"
                    onClick={() => setEditTarget({ index: i, field: "date" })}
                  />
                  <SelectButton
                    chevron={false}
                    value={item.remindAt ? pickedTime : ""}
                    placeholder="選擇時間"
                    onClick={() => setEditTarget({ index: i, field: "time" })}
                  />
                </FieldRow>
              </Field>
            </EditorItemCard>
          </div>
        );
      })}

      <AddButton onClick={() => setItems((list) => [...list, blankDraft()])}>新增{copy.memo}</AddButton>

      <DatePickerModal
        key={editTarget?.field === "date" ? `date-${editTarget.index}` : "date-closed"}
        open={editTarget?.field === "date"}
        initial={editing?.date ?? todayLocal()}
        onClose={() => setEditTarget(null)}
        onSave={(value) => {
          if (editTarget) updateItem(editTarget.index, { remindAt: `${value}T${splitRemindAt(items[editTarget.index].remindAt).time}` });
          setEditTarget(null);
        }}
      />

      <TimePickerModal
        key={editTarget?.field === "time" ? `time-${editTarget.index}` : "time-closed"}
        open={editTarget?.field === "time"}
        initial={editing?.time ?? "09:00"}
        onClose={() => setEditTarget(null)}
        onSave={(value) => {
          if (editTarget) updateItem(editTarget.index, { remindAt: `${splitRemindAt(items[editTarget.index].remindAt).date}T${value}` });
          setEditTarget(null);
        }}
      />
    </EditorSheet>
  );
}
