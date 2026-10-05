"use client";

import { useState } from "react";
import { ImageSlot } from "./image-slot";

export interface CaptionImageDraft {
  id?: string;
  title: string;
  caption: string;
  image: string;
}

export interface CaptionImageInitial {
  id: string;
  title: string;
  caption: string;
  image: string;
}

/** 首頁「週末小旅行」「上方文案」共用同一套編輯邏輯：好幾組標題＋文案＋背景圖，每次進
 *  首頁／重新整理隨機挑一組顯示——兩個功能的資料形狀、編輯流程完全一樣，差別只在存在
 *  哪個 API、預設墊檔內容是什麼，所以不各自寫一份彈窗，呼叫端傳自己的標題／說明文字／
 *  預設清單就好。 */
export function CaptionImageEditorModal({
  open,
  heading,
  description,
  itemLabel,
  imageOptions,
  defaultDrafts,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  /** 彈窗標題列文字，例如「編輯週末小旅行」。 */
  heading: string;
  /** 標題列下方的說明文字。 */
  description: string;
  /** 每一組的稱呼，例如「組」。 */
  itemLabel: string;
  /** 背景圖只能從這幾張裡選，不給使用者自己輸入路徑／上傳——避免存進資料庫的路徑打錯字
   *  或指到不存在的檔案，跟備忘錄的圖示選擇用同一套做法。 */
  imageOptions: string[];
  /** 使用者還沒存過任何一組時，先墊著的預設草稿清單。 */
  defaultDrafts: () => CaptionImageDraft[];
  initial: CaptionImageInitial[];
  onClose: () => void;
  onSave: (items: CaptionImageDraft[]) => void;
}) {
  const [items, setItems] = useState<CaptionImageDraft[]>(
    initial.length > 0 ? initial.map((t) => ({ id: t.id, title: t.title, caption: t.caption, image: t.image })) : defaultDrafts(),
  );

  if (!open) return null;

  function updateItem(index: number, patch: Partial<CaptionImageDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30" onClick={onClose}>
      {/* max-h 用 % 不是 vh：外層卡片容器有 transform，是這個 fixed 彈窗的定位基準，桌面寬度
          時卡片是寫死 850px 高、不是跟著瀏覽器視窗高度變化，vh 會抓到瀏覽器高度而不是卡片
          高度，兩者不一致時彈窗會比卡片本身還高。 */}
      <div className="flex max-h-[70%] w-full flex-col overflow-y-auto rounded-t-[1.75rem] bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">{heading}</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <p className="px-5 pt-4 text-xs text-[#9C94C4]">{description}</p>

        <div className="flex flex-col gap-4 px-5 py-5">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#9C94C4]">
                  第 {i + 1} {itemLabel}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-xs font-medium text-[#D1517E]">
                    刪除
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {imageOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updateItem(i, { image: option })}
                    aria-label={`選擇背景圖 ${option}`}
                    className={item.image === option ? "" : "opacity-50"}
                  >
                    <ImageSlot src={option} alt="背景圖選項" className="size-14 rounded-xl" />
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="標題"
                value={item.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                className="rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
              <input
                type="text"
                placeholder="文案"
                value={item.caption}
                onChange={(e) => updateItem(i, { caption: e.target.value })}
                className="rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems((list) => [...list, { title: "", caption: "", image: imageOptions[0] ?? "" }])}
            className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
          >
            ＋ 新增一{itemLabel}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(items.filter((it) => it.title.trim() && it.caption.trim() && it.image.trim()))}
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
