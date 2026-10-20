"use client";

import type { ReactNode } from "react";

/** 「一次填好幾則、按一次儲存整批送出」那種彈窗的外框——新增分類、新增帳戶類型都是
 *  這個形狀：每一則包在一張卡片裡、右上角可以刪掉這一則（只剩一則時不給刪）、最下面
 *  一顆虛線的「＋新增一則」。
 *
 *  每一則裡面要填什麼欄位各家不同，交給 renderItem 自己決定；這裡只負責共通的外框跟
 *  增減草稿的按鈕。 */
export function BatchDraftList<T>({
  items,
  onRemove,
  onAdd,
  renderItem,
  addLabel = "＋ 新增一則",
}: {
  items: T[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  renderItem: (item: T, index: number) => ReactNode;
  addLabel?: string;
}) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-[#ECE4FA] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9C94C4]">第 {i + 1} 則</span>
            {items.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="text-xs font-medium text-[#D1517E]">
                刪除
              </button>
            )}
          </div>
          {renderItem(item, i)}
        </div>
      ))}

      <button type="button" onClick={onAdd} className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]">
        {addLabel}
      </button>
    </>
  );
}
