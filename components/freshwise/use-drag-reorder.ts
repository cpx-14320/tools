"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * 清單拖曳排序（我的菜籃的分類與項目用）。
 *
 * 手機（觸控）跟桌面（滑鼠）走同一套 pointer 事件，不用 HTML5 的 `draggable`——那套在
 * 觸控裝置上根本不會觸發，手機完全拖不動。也不裝任何拖拉套件：要的行為很單純（上下換
 * 位置），一個 hook 就夠。
 *
 * 做法：拖曳時直接即時換掉陣列裡的順序（`onMove`），不拖半透明分身——這樣不用自己算
 * transform、也不用處理捲動偏移，每一列原地就看得到自己被推開；放手時（`onCommit`）才
 * 真的存檔。只有順序真的變過才會 commit。
 *
 * ```tsx
 * const drag = useDragReorder(items.length, move, commit);
 * items.map((it, i) => (
 *   <div key={it.id} ref={drag.rowRef(i)} className={drag.rowClass(i)}>
 *     <DragHandle label={`拖曳排序 ${it.name}`} {...drag.handleProps(i)} />
 *   </div>
 * ))
 * ```
 *
 * handleProps 已經帶了 `touch-action: none`，不然手機上按住握把往下拖會變成捲動頁面。
 */
export function useDragReorder(
  count: number,
  /** 把第 from 筆搬到第 to 筆的位置——呼叫端自己用這個更新 state。 */
  onMove: (from: number, to: number) => void,
  /** 放手時呼叫，只有順序真的變過才會觸發。 */
  onCommit: () => void,
) {
  const rows = useRef<(HTMLElement | null)[]>([]);
  const dragging = useRef<number | null>(null);
  const changed = useRef(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function start(index: number, e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = index;
    changed.current = false;
    setDragIndex(index);
    // 把後續的 pointermove／pointerup 鎖在握把上，手指滑出握把範圍（一定會）之後事件
    // 還是送到這裡，不會中途斷掉。
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
      // 用「整列範圍」而不是「中線」判斷：每一列高度不一樣（有的項目有填數量、有的沒有），
      // 中線在高矮交錯的清單裡會來回抖動。
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
    dragIndex,
    rowRef: (index: number) => (el: HTMLElement | null) => {
      rows.current[index] = el;
    },
    /** 被拖曳中的那一列要浮起來一點，使用者才看得出自己正拖著哪一筆。 */
    rowClass: (index: number) => (dragIndex === index ? "relative z-10 opacity-90" : ""),
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
