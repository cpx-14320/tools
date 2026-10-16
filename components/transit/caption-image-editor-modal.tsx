"use client";

import { useState } from "react";
import { ImageSlot } from "./image-slot";
import { EditorSheet } from "./editor-sheet";
import { AddButton, DragHandle, EditorItemCard, EditorItemHeader, TextInput } from "./ui";
import { moveItem, useDragReorder } from "./use-drag-reorder";

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

/** 首頁「主視覺」「橫幅」共用同一套編輯邏輯：好幾組標題＋文案＋背景圖，每次進首頁／
 *  重新整理隨機挑一組顯示——兩個功能的資料形狀、編輯流程完全一樣，差別只在存在哪個
 *  API、說明文字是什麼，所以不各自寫一份彈窗，呼叫端傳自己的標題／說明文字／預設清單
 *  就好。 */
export function CaptionImageEditorModal({
  open,
  heading,
  description,
  itemLabel,
  imageOptions,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  /** 彈窗標題列文字，例如「編輯橫幅」。 */
  heading: string;
  /** 標題列下方的說明文字。 */
  description: string;
  /** 每一組的稱呼，例如「組」。 */
  itemLabel: string;
  /** 背景圖只能從這幾張裡選，不給使用者自己輸入路徑／上傳——避免存進資料庫的路徑打錯字
   *  或指到不存在的檔案，跟備忘錄的圖示選擇用同一套做法。 */
  imageOptions: string[];
  initial: CaptionImageInitial[];
  onClose: () => void;
  onSave: (items: CaptionImageDraft[]) => void;
}) {
  // 使用者還沒存過任何一組時，清單就是空的，不要先塞一批假資料讓使用者自己刪——首頁那邊
  // 本來就有「還沒設定時顯示預設文案」的退回邏輯（見 home-view.tsx／more-view.tsx），
  // 不需要在編輯彈窗裡重複一份。
  const [items, setItems] = useState<CaptionImageDraft[]>(
    initial.map((t) => ({ id: t.id, title: t.title, caption: t.caption, image: t.image })),
  );
  const drag = useDragReorder(
    items.length,
    (from, to) => setItems((list) => moveItem(list, from, to)),
    () => {},
  );

  function updateItem(index: number, patch: Partial<CaptionImageDraft>) {
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((list) => list.filter((_, i) => i !== index));
  }

  return (
    <EditorSheet
      open={open}
      title={heading}
      description={description}
      onClose={onClose}
      onSave={() => onSave(items.filter((it) => it.title.trim() && it.caption.trim() && it.image.trim()))}
    >
      {items.map((item, i) => (
        <div key={i} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
          <EditorItemCard>
            <EditorItemHeader
              index={i}
              unit={itemLabel}
              onDelete={() => removeItem(i)}
              dragHandle={<DragHandle label={`拖曳排序 第 ${i + 1} ${itemLabel}`} {...drag.handleProps(i)} />}
            />

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

            <TextInput type="text" placeholder="標題" value={item.title} onChange={(e) => updateItem(i, { title: e.target.value })} />
            <TextInput type="text" placeholder="文案" value={item.caption} onChange={(e) => updateItem(i, { caption: e.target.value })} />
          </EditorItemCard>
        </div>
      ))}

      <AddButton onClick={() => setItems((list) => [...list, { title: "", caption: "", image: imageOptions[0] ?? "" }])}>
        新增一{itemLabel}
      </AddButton>
    </EditorSheet>
  );
}
