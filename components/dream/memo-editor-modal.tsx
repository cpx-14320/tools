"use client";

import { useState } from "react";
import { ImageSlot } from "./image-slot";
import { MEMO_ICON_OPTIONS } from "./memo-icons";
import { DatePickerModal } from "./date-picker-modal";
import { TimePickerModal } from "./time-picker-modal";

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
  // 跟首頁「編輯常用行程」的時段區間同一套做法：日期／時間共用同一顆彈窗元件，用
  // {index, field} 記住現在是在幫第幾則的哪個欄位選值，不用每一則各自配一組彈窗狀態。
  const [editTarget, setEditTarget] = useState<{ index: number; field: "date" | "time" } | null>(null);

  if (!open) return null;

  function updateItem(index: number, patch: Partial<MemoDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  const editing = editTarget ? splitRemindAt(items[editTarget.index].remindAt) : null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      {/* max-h 用 % 不是 vh：外層卡片容器有 transform，是這個 fixed 彈窗的定位基準，桌面寬度
          時卡片是寫死 850px 高、不是跟著瀏覽器視窗高度變化，vh 會抓到瀏覽器高度而不是卡片
          高度，兩者不一致時彈窗會比卡片本身還高。 */}
      <div
        className="flex max-h-[70%] w-full flex-col overflow-y-auto rounded-t-[1.75rem] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">編輯備忘錄</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {items.map((item, i) => {
            const { date: pickedDate, time: pickedTime } = splitRemindAt(item.remindAt);
            return (
              <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#9C94C4]">第 {i + 1} 則</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="text-xs font-medium text-[#D1517E]">
                      刪除
                    </button>
                  )}
                </div>

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

                <textarea
                  placeholder="內容"
                  value={item.content}
                  onChange={(e) => updateItem(i, { content: e.target.value })}
                  rows={2}
                  className="resize-none rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
                />

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#9C94C4]">提醒時間（選填）</span>
                    {item.remindAt && (
                      <button type="button" onClick={() => updateItem(i, { remindAt: "" })} className="text-xs font-medium text-[#D1517E]">
                        清除
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditTarget({ index: i, field: "date" })}
                      className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-left text-sm font-medium text-[#4A3B7C]"
                    >
                      <span className="flex-1 truncate">{item.remindAt ? pickedDate.replaceAll("-", "/") : "選擇日期"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTarget({ index: i, field: "time" })}
                      className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-left text-sm font-medium text-[#4A3B7C]"
                    >
                      <span className="flex-1 truncate">{item.remindAt ? pickedTime : "選擇時間"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setItems((list) => [...list, blankDraft()])}
            className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
          >
            ＋ 新增一則
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(items.filter((it) => it.content.trim()))}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            儲存
          </button>
        </div>
      </div>

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
    </div>
  );
}
