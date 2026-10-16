"use client";

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

/** 列表每一列左邊的選取圓點——選取模式開啟時取代原本點了就跳編輯彈窗的行為。 */
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
