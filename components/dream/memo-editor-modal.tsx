"use client";

import { useState } from "react";
import { ImageSlot } from "./image-slot";
import { MEMO_ICON_OPTIONS } from "./memo-icons";

export interface MemoDraft {
  id?: string;
  title: string;
  content: string;
  icon: string;
  remindAt: string; // datetime-local 輸入框的格式（本地時間，沒有時區），空字串＝沒填
}

export interface MemoInitial {
  id: string;
  title: string;
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

function blankDraft(): MemoDraft {
  return { title: "", content: "", icon: MEMO_ICON_OPTIONS[0].key, remindAt: "" };
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
      ? initial.map((m) => ({ id: m.id, title: m.title, content: m.content, icon: m.icon, remindAt: toDatetimeLocal(m.remindAt) }))
      : [blankDraft()],
  );

  if (!open) return null;

  function updateItem(index: number, patch: Partial<MemoDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[400px] flex-col overflow-y-auto rounded-[1.75rem] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">編輯備忘錄</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#9C94C4]">第 {i + 1} 則</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-xs font-medium text-[#D1517E]">
                    刪除
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {MEMO_ICON_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateItem(i, { icon: option.key })}
                    aria-label={`選擇圖示 ${option.key}`}
                    className={`rounded-xl p-0.5 ${item.icon === option.key ? "ring-2 ring-[#6F5FD6]" : ""}`}
                  >
                    <ImageSlot src={option.icon} alt={option.key} className="size-9 rounded-lg" />
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="標題"
                value={item.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                className="rounded-xl border border-[#ECE4FA] bg-white px-3 py-2 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
              <textarea
                placeholder="內容"
                value={item.content}
                onChange={(e) => updateItem(i, { content: e.target.value })}
                rows={2}
                className="resize-none rounded-xl border border-[#ECE4FA] bg-white px-3 py-2 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[#9C94C4]">提醒時間（選填）</span>
                <input
                  type="datetime-local"
                  value={item.remindAt}
                  onChange={(e) => updateItem(i, { remindAt: e.target.value })}
                  className="rounded-xl border border-[#ECE4FA] bg-white px-3 py-2 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
                />
              </label>
            </div>
          ))}

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
            onClick={() => onSave(items.filter((it) => it.title.trim() || it.content.trim()))}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
