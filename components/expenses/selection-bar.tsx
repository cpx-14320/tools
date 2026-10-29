"use client";

import { useState } from "react";
import { PillButton } from "./button";

/** 多選模式的狀態——分類、帳戶類型、存錢目標、固定收支四個清單頁本來各自寫一份一模一樣的
 *  `selecting` / `selectedIds` / `toggleSelected` / 清空邏輯，收斂成這一個 hook。
 *  `ids` 傳目前畫面上「可以被選」的項目 id（已經過分頁篩選的那批），全選才不會把看不到的
 *  項目也一起選進來。 */
export function useSelection(ids: string[]) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelectedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exit() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  return {
    selecting,
    selectedIds,
    toggle,
    exit,
    /** 「選取／完成」那顆按鈕要綁的事件：退出選取模式時順便把已選的清掉。 */
    toggleMode: () => (selecting ? exit() : setSelecting(true)),
    toggleAll: () => setSelectedIds((set) => (set.size === ids.length ? new Set() : new Set(ids))),
    total: ids.length,
  };
}

/** 進入／離開多選模式的那顆按鈕——跟分頁切換（SegmentedControl）等高，可以並排在同一列。 */
export function SelectionToggle({ selecting, onToggle }: { selecting: boolean; onToggle: () => void }) {
  return (
    <PillButton onClick={onToggle} active={selecting}>
      {selecting ? "完成" : "選取"}
    </PillButton>
  );
}

/** 多選刪除共用的工具列——分類、帳戶類型、存錢目標、固定收支這幾個清單頁都用同一套：
 *  點「選取」進入選取模式，列表的列會換成可以打勾；這條工具列顯示已選幾項、全選/取消
 *  全選、退出選取模式、刪除已選的項目。 */
export function SelectionBar({
  count,
  total,
  onToggleAll,
  onCancel,
  onDelete,
}: {
  count: number;
  total: number;
  onToggleAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const allSelected = total > 0 && count === total;
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-[#F3EFFC] px-4 py-2.5">
      <button type="button" onClick={onToggleAll} className="text-xs font-medium text-[#6F5FD6]">
        {allSelected ? "取消全選" : "全選"}
      </button>
      <span className="text-xs font-medium text-[#4A3B7C]">已選 {count} 項</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="text-xs font-medium text-[#9C94C4]">
          取消
        </button>
        <button
          type="button"
          disabled={count === 0}
          onClick={onDelete}
          className="text-xs font-semibold text-[#D1517E] disabled:opacity-40"
        >
          刪除
        </button>
      </div>
    </div>
  );
}

/** 列表每一列左邊的選取圓點。
 *
 *  它只是「指示器」，本身不可點：真正的勾選目標是整一列（呼叫端把整列包成一個
 *  `role="checkbox"` 的按鈕）。圓點自己也做成按鈕的話，一列裡會有兩個互相重疊的點擊
 *  目標，而且圓點只有 20px，手機上很容易點歪——以前就是這樣，使用者直覺去點圓圈卻
 *  沒反應，要點到右邊的文字區才選得起來。 */
export function SelectionDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-5 shrink-0 place-items-center rounded-full border text-xs ${
        selected ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#C7BFE6] bg-white"
      }`}
    >
      {selected ? "✓" : ""}
    </span>
  );
}
