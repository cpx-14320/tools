"use client";

import { useState } from "react";
import { PillButton } from "./button";

/** 多選模式的狀態——分類、帳戶類型、存錢目標、固定收支、明細這幾個清單頁本來各自寫一份
 *  一模一樣的 `selecting` / `selectedIds` / `toggleSelected` / 清空邏輯，收斂成這一個 hook。
 *
 *  `ids` 傳目前畫面上「可以被選」的項目 id（已經過分頁、篩選的那批）。**已選的會自動被
 *  這份清單過濾**：在選取模式中途改篩選條件（明細頁可以邊選邊改日期、分類、「只看未指定
 *  帳戶」）時，之前選到、現在已經捲不到的那幾筆要跟著失效——不然工具列上的數字會把它們
 *  算進去，接著按「改帳戶」就改到使用者**看不見而且沒打算改**的紀錄。實測踩過：篩成
 *  「只看未指定帳戶（1 筆）」後按全選，動到的卻是切換篩選前選的另一筆。 */
export function useSelection(ids: string[]) {
  const [selecting, setSelecting] = useState(false);
  const [rawSelected, setRawSelected] = useState<Set<string>>(new Set());

  // 直接算，不用 useMemo：ids 每次 render 都是新陣列（呼叫端是 rows.map(...)），memo 的
  // 相依永遠在變，包了也不會少算一次，只是多一層看起來有做快取的誤導。
  const visible = new Set(ids);
  const selectedIds = new Set([...rawSelected].filter((id) => visible.has(id)));

  function toggle(id: string) {
    setRawSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exit() {
    setSelecting(false);
    setRawSelected(new Set());
  }

  return {
    selecting,
    selectedIds,
    toggle,
    exit,
    /** 「選取／完成」那顆按鈕要綁的事件：退出選取模式時順便把已選的清掉。 */
    toggleMode: () => (selecting ? exit() : setSelecting(true)),
    // 比對的是「看得到的已選數」而不是 rawSelected.size——後者可能含已經被篩掉的 id，
    // 會讓「全選／取消全選」在明明還沒全選的狀態下就變成取消。順便把殘留的 id 清掉。
    toggleAll: () => setRawSelected(selectedIds.size === ids.length ? new Set() : new Set(ids)),
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

/** 多選模式的其中一個動作（改帳戶、改分類…）。刪除不走這裡，它有自己的樣式跟位置。 */
export interface SelectionAction {
  label: string;
  onClick: () => void;
}

/** 多選共用的工具列——分類、帳戶類型、存錢目標、固定收支、明細這幾個頁面都用同一套：
 *  點「選取」進入選取模式，列表的列會換成可以打勾；這條工具列負責全選、顯示已選幾項、
 *  退出選取模式，以及對選到的那批做事。
 *
 *  版面是兩行：**第一行右邊放動作、第二行右邊放「已選 N 項」**。
 *
 *  為什麼動作在上面而不是跟著數量走：這條列出現的時候，使用者已經選完了，下一步是「要
 *  對它們做什麼」——動作才是這一刻的主角，數量是確認用的輔助資訊。動作放在拇指最容易
 *  構到的第一行，數量退到第二行當註腳。而且明細頁有三個動作，全部擠在一行裡，「取消全選」
 *  那個狀態會把第一行撐到換行，變成一條高矮不定的列。
 *
 *  `actions` 給多個動作用（目前只有明細頁的改帳戶／改分類）；只傳 onDelete 的那四頁
 *  第一行右邊就只有一顆紅色的「刪除」。 */
export function SelectionBar({
  count,
  total,
  actions = [],
  onToggleAll,
  onCancel,
  onDelete,
}: {
  count: number;
  total: number;
  actions?: SelectionAction[];
  onToggleAll: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const allSelected = total > 0 && count === total;
  const disabled = count === 0;
  return (
    // 白底＋淡紫邊框，跟清單卡片同一種底色。本來整條是淡紫底（#F3EFFC），在同樣是淡紫
    // 的頁面背景上看起來像一塊暈開的色塊，而且它壓在白色清單卡上方時又變成第三種底色。
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onToggleAll} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
          {allSelected ? "取消全選" : "全選"}
        </button>
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={disabled}
              onClick={action.onClick}
              // 改資料的動作用淡紫膠囊（跟固定收支待確認的「確認」同一顆），刪除維持純紅字
              // 不加底——同樣是按鈕，但一個是補資料、一個是不可逆，不該長得一樣重。
              // 底色跟著整條列從白底換成淡紫：整條變白之後，原本的白底膠囊在白上看不見。
              className="rounded-full bg-[#F3EFFC] px-3 py-1 text-xs font-medium text-[#6F5FD6] disabled:opacity-40"
            >
              {action.label}
            </button>
          ))}
          <button type="button" disabled={disabled} onClick={onDelete} className="text-xs font-semibold text-[#D1517E] disabled:opacity-40">
            刪除
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs font-medium text-[#4A3B7C]">已選 {count} 項</span>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-[#9C94C4]">
          取消
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
