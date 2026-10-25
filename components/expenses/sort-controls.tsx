"use client";

import { PillButton } from "./button";

/** 進入／離開排序模式的那顆按鈕——跟「選取」（SelectionToggle）長一樣、並排在標題列。 */
export function SortToggle({ sorting, onToggle }: { sorting: boolean; onToggle: () => void }) {
  return (
    <PillButton onClick={onToggle} active={sorting}>
      {sorting ? "完成" : "排序"}
    </PillButton>
  );
}

/** 一列右邊的「往上／往下各移一格」。
 *
 *  刻意用上下箭頭而不是拖曳：整個記帳本是一張固定高度、內部自己捲動的卡片
 *  （見 expenses-mobile-shell.tsx），拖曳排序在這種容器裡很容易跟捲動打架——手指一動
 *  到底是要捲頁面還是要拖那一列，在手機上特別難分。點一下移動一格沒有這個問題，
 *  而且清單本來就不長（主分類十幾個、子項目不到十個），點幾下就到位。
 *
 *  已經在頂／底的那一顆變淡且不能按，不是整顆消失——消失的話每一列的按鈕數不一樣，
 *  右邊會參差不齊。 */
export function SortArrows({
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Arrow dir="up" onClick={onUp} disabled={!canUp} />
      <Arrow dir="down" onClick={onDown} disabled={!canDown} />
    </span>
  );
}

function Arrow({ dir, onClick, disabled }: { dir: "up" | "down"; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      // 排序的列整列本身也是可以點的（編輯分類），箭頭要自己攔下點擊，不然按一下
      // 會同時移動順序又把編輯彈窗打開。
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={dir === "up" ? "往上移一格" : "往下移一格"}
      className={`grid size-8 place-items-center rounded-full transition-colors ${
        disabled ? "text-[#DCD5F0]" : "text-[#6F5FD6] hover:bg-[#F3EFFC]"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
        {dir === "up" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  );
}
