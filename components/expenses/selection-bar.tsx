"use client";

import { useState, type ReactNode } from "react";
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

/** 進入／離開多選模式的那顆按鈕——跟分頁切換（SegmentedControl）等高，可以並排在同一列。
 *
 *  **選取模式中這顆寫「取消」，不是「完成」**：它做的事是「退出選取模式、把勾選清掉」，
 *  那就是取消。寫「完成」會被讀成「把剛剛選的那些送出去」，按下去卻什麼都沒發生——
 *  選取本身不是一個要送出的表單，真正會動資料的是工具列上的刪除／修改那幾顆。
 *
 *  （隔壁的「排序」反過來是對的：排序模式下每按一次箭頭就已經存檔了，離開時沒有東西
 *  要取消，所以 SortToggle 維持「完成」。兩顆長得一樣但字不同，是因為它們真的不一樣。） */
export function SelectionToggle({ selecting, onToggle }: { selecting: boolean; onToggle: () => void }) {
  return (
    <PillButton onClick={onToggle} active={selecting}>
      {selecting ? "取消" : "選取"}
    </PillButton>
  );
}

/** 多選模式的其中一個動作（改帳戶、改分類、還原…）。刪除不走這裡，它有自己的樣式跟位置。 */
export interface SelectionAction {
  label: string;
  onClick: () => void;
  /** 勾了東西但這個動作仍然不能按時給 true（待確認頁的「確認」遇到還沒分類完的批次就是
   *  這種）。沒勾任何一項時本來就是停用的，不用在呼叫端自己再判斷一次。 */
  disabled?: boolean;
}

/** 「已經選好要套用什麼，但還沒送出」的待確認狀態。
 *
 *  **為什麼要有這一段**：批次修改帳戶／分類原本是「在彈窗裡點到哪個帳戶就立刻送出」，
 *  點錯就是直接改掉幾十筆資料，而且使用者對自己剛剛點了什麼沒有任何複查的機會。改成
 *  選完只是記在這裡、工具列顯示「修改帳戶 → 玉山銀行」，要再按一次「完成」才真的動資料。
 *
 *  想換成別的目標就按「取消」重選——沒有做成「點摘要再開彈窗」，因為那顆摘要同時是
 *  狀態顯示又是按鈕，看不出來可以點。 */
export interface SelectionPending {
  /** 工具列上顯示的待套用內容，例如「修改帳戶 → 玉山銀行」。 */
  summary: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  /** 放掉這次選的目標值，回到原本那排動作按鈕（不會離開選取模式、不會清掉勾選的項目）。 */
  onCancel: () => void;
  busy?: boolean;
}

/** 多選共用的工具列——分類、帳戶類型、存錢目標、固定收支、明細這幾個頁面都用同一套：
 *  點「選取」進入選取模式，列表的列會換成可以打勾；這條工具列負責全選、顯示已選幾項，
 *  以及對選到的那批做事。
 *
 *  **退出選取模式不在這條列上**：上面那顆「取消」（SelectionToggle）就是出口，它跟這條
 *  列一起釘在頂端、永遠按得到。這裡本來還有一顆同樣寫著「取消」的按鈕，等於同一個畫面
 *  上兩顆字一樣的按鈕做同一件事，右邊那排也被它多佔一格。
 *
 *  **收成一列**：左邊「全選 ・ 已選 N 項」，右邊是動作。這條列跟排序／選取那一排一起
 *  釘在卡片頂端（見 StickyToolbar），釘住的東西每多一列，清單就少看一列——原本兩列的
 *  版本（動作一列、數量一列）在釘住之後太佔。
 *
 *  待套用（pending）狀態也是一列：「修改分類：→ 零嘴 › 甜食 ・ 已選 N 項」在左，
 *  「重選／完成」在右——那兩顆管的是「挑好的那個目標」，跟上面那顆退出選取模式的
 *  「取消」不是同一層，所以刻意不共用同一個字（見底下那顆按鈕的說明）。 */
export function SelectionBar({
  count,
  total,
  unit = "項",
  actions = [],
  pending,
  onToggleAll,
  onDelete,
  deleteLabel = "刪除",
}: {
  count: number;
  total: number;
  /** 「已選 N ○」的量詞。預設「項」；待確認那頁一次處理的是一整批解析結果，用「批」。 */
  unit?: string;
  actions?: SelectionAction[];
  /** 給了就切換成待確認樣式：第一行變成「要套用什麼＋完成」，動作跟刪除都先收起來。 */
  pending?: SelectionPending;
  onToggleAll: () => void;
  onDelete: () => void;
  /** 紅色那顆的字。預設「刪除」；垃圾桶那頁刪掉就真的沒了，要寫明「永久刪除」。 */
  deleteLabel?: string;
}) {
  const allSelected = total > 0 && count === total;
  const disabled = count === 0;

  if (pending) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2">
        {/* 左邊「要套用什麼」，全選先收起來——這一刻該做的是確認或取消，再讓人去改選了
            哪些項目，等於邀請使用者在送出前一刻又動一次範圍。 */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-[#4A3B7C]">{pending.summary}</span>
          <span className="shrink-0 text-xs text-[#9C94C4]">
            已選 {count} {unit}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 「重選」只放掉剛挑的目標值，不會整個退出選取模式——勾了半天的項目因為想換
              一個帳戶就全部清掉，使用者得從頭再勾一次。
              **為什麼不叫「取消」**：上面那顆退出選取模式的也叫取消，同一個畫面上兩顆
              一樣的字做不同範圍的事（一個丟掉這次挑的目標、一個丟掉整批勾選），使用者
              只能靠位置猜。這顆做的是「回去重挑一個」，就寫重選；「取消」在整個記帳本裡
              固定只代表一件事：離開選取模式。 */}
          <button type="button" disabled={pending.busy} onClick={pending.onCancel} className="text-xs font-medium text-[#9C94C4] disabled:opacity-40">
            重選
          </button>
          <button
            type="button"
            disabled={disabled || pending.busy}
            onClick={pending.onConfirm}
            // 唯一會動到資料的那一顆，所以是整條列上最實心的樣式（實心紫底）。
            className="rounded-full bg-[#6F5FD6] px-3.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            {pending.confirmLabel ?? "完成"}
          </button>
        </div>
      </div>
    );
  }

  return (
    // 白底＋淡紫邊框，跟清單卡片同一種底色。本來整條是淡紫底（#F3EFFC），在同樣是淡紫
    // 的頁面背景上看起來像一塊暈開的色塊，而且它壓在白色清單卡上方時又變成第三種底色。
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2">
      {/* 全選跟數量擺一起：兩個都在講「選了哪些」。數量用淡字當註腳，全選才是可以按的。 */}
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={onToggleAll} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
          {allSelected ? "取消全選" : "全選"}
        </button>
        <span className="truncate text-xs text-[#9C94C4]">
          已選 {count} {unit}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={disabled || action.disabled}
            onClick={action.onClick}
            // 改資料的動作用淡紫膠囊（跟固定收支待確認的「確認」同一顆），刪除維持純紅字
            // 不加底——同樣是按鈕，但一個是補資料、一個是不可逆，不該長得一樣重。
            className="rounded-full bg-[#F3EFFC] px-3 py-1 text-xs font-medium text-[#6F5FD6] disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={onDelete} className="text-xs font-semibold text-[#D1517E] disabled:opacity-40">
          {deleteLabel}
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
