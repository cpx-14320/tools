"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * 清單拖曳排序。手機（觸控）跟桌面（滑鼠）走同一套 pointer 事件，不用 HTML5 的
 * draggable——那套在觸控裝置上根本不會觸發，手機完全拖不動。也不裝任何拖拉套件：這裡
 * 要的行為很單純（上下換位置），一個 hook 就夠，不值得多一個依賴。
 *
 * 做法：拖曳時直接即時換掉陣列裡的順序（`onMove`），不是拖一個半透明的分身在上面飄——
 * 這樣不用自己算 transform、也不用處理捲動偏移，每一列原地就看得到自己被推開，放手時
 * （`onCommit`）才真的寫回資料庫／存檔。只有順序真的變過才會 commit。
 *
 * 用法：
 * ```tsx
 * const drag = useDragReorder(items.length, move, commit);
 * items.map((it, i) => (
 *   <div key={it.id} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
 *     <button {...drag.handleProps(i)}>≡</button>
 *   </div>
 * ))
 * ```
 * 握把要自己擋住捲動（handleProps 已經加了 `touch-action: none`），不然在手機上按住
 * 握把往下拖會變成捲動頁面。
 */
export function useDragReorder(
  count: number,
  /** 把第 from 筆搬到第 to 筆的位置——呼叫端自己用這個更新 state。 */
  onMove: (from: number, to: number) => void,
  /** 放手時呼叫，只有順序真的變過才會觸發（用來存檔／打 API）。 */
  onCommit: () => void,
) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const dragging = useRef<number | null>(null);
  const changed = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function start(index: number, e: ReactPointerEvent<HTMLElement>) {
    // 握把本身是 <button>，按下去不要順便觸發原生的拖曳選取／點擊行為。
    e.preventDefault();
    e.stopPropagation();
    dragging.current = index;
    changed.current = false;
    setDragIndex(index);
    // 把後續的 pointermove／pointerup 都鎖在握把上，手指滑出握把範圍（一定會）之後
    // 事件還是送到這裡，不會中途斷掉。
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const from = dragging.current;
    if (from === null) return;
    const y = e.clientY;
    for (let i = 0; i < count; i++) {
      if (i === from) continue;
      const rect = rows.current[i]?.getBoundingClientRect();
      if (!rect) continue;
      // 手指所在的 y 落在哪一列的範圍裡，就把拖著的那筆換到那一列的位置。用「整列範圍」
      // 而不是「中線」判斷，是因為每一列高度不一樣（分類底下的行程筆數不同），中線在
      // 高矮交錯的清單裡會來回抖動。
      if (y >= rect.top && y <= rect.bottom) {
        onMove(from, i);
        dragging.current = i;
        changed.current = true;
        setDragIndex(i);
        break;
      }
    }
  }

  function end() {
    if (dragging.current === null) return;
    dragging.current = null;
    setDragIndex(null);
    if (changed.current) {
      changed.current = false;
      onCommit();
    }
  }

  return {
    /** 目前正在被拖曳的 index（可以用來加上提高層級／半透明的視覺提示）。 */
    dragIndex,
    /** 把每一列的 DOM 參考交給 hook，拖曳時才量得到每一列的位置。 */
    rowRef: (index: number) => (el: HTMLElement | null) => {
      rows.current[index] = el;
    },
    /** 被拖曳中的那一列要浮起來一點，使用者才看得出來自己正拖著哪一筆。 */
    rowClass: (index: number) => (dragIndex === index ? "relative z-10 opacity-90" : ""),
    /** 展開在握把元素上。 */
    handleProps: (index: number) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(index, e),
      onPointerMove: move,
      onPointerUp: end,
      onPointerCancel: end,
      style: { touchAction: "none" as const, cursor: dragIndex === index ? "grabbing" : "grab" },
    }),
  };
}

/** 陣列搬移的小工具——每個用到拖曳排序的地方都要同一段邏輯，不要各自寫一次。 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
