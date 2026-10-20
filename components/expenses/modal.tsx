"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { text } from "./theme";

export const fieldInputClass =
  "w-full rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2.5 text-sm text-[#4A3B7C] outline-none focus:border-[#6F5FD6]";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={text.label}>{label}</span>
      {children}
    </label>
  );
}

/** 記帳本共用彈窗外殼，比照搭乘車的 BottomSheetModal（components/transit/bottom-sheet-modal.tsx）：
 *  用 createPortal 掛到 document.body，不是直接畫在呼叫端的 DOM 位置——ExpensesMobileShell
 *  的卡片容器本身有 transform（見 expenses-mobile-nav.tsx 的說明），fixed 子孫的疊圖順序在
 *  部分行動裝置瀏覽器上不可靠，掛到 document.body 之後完全脫離那個脈絡，不會再被牽連。
 *  手機寬度從底部彈出（rounded-t-[1.75rem]），桌面寬度跟卡片容器一起置中，寬度對齊
 *  ExpensesMobileShell 的 max-w-[430px]。 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  /** 內容很多的彈窗（例如新增交易：分類格子＋小鍵盤＋一堆欄位）可以撐到滿版高度，
   *  不要卡在 80% 讓可視區太短。 */
  fullHeight = false,
  /** 固定在內容區下方、不跟著捲動的那一塊（新增交易的小鍵盤用）——放在這裡而不是
   *  children 裡面，使用者捲動上面的資訊時鍵盤才會一直留在原地。 */
  stickyBottom,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
  stickyBottom?: ReactNode;
}) {
  // createPortal 需要 document 存在，伺服器端渲染時還沒有，掛載後才真的 portal 出去，
  // 避免 SSR／CSR 的輸出不一致——跟 BottomSheetModal 同一招。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative flex h-full w-full justify-center px-0 py-0 sm:px-4 sm:py-6">
        <div className="flex h-dvh w-full max-w-[430px] items-end sm:h-[850px]">
          <div
            className={`flex w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white ${fullHeight ? "h-full max-h-full" : "max-h-[80%]"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
              <p className="font-semibold text-[#4A3B7C]">{title}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]"
              >
                ✕
              </button>
            </div>

            {/* 標題、stickyBottom 跟 footer 固定不動，只有這一段內容自己捲動——不然表單一長，
                連「取消／儲存」都會被捲出畫面外。 */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">{children}</div>

            {stickyBottom && <div className="shrink-0 border-t border-[#ECE4FA] px-5 py-3">{stickyBottom}</div>}

            {footer && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#ECE4FA] px-5 py-4">{footer}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 彈窗底部那排按鈕：左邊（可選）刪除、右邊取消＋主要動作。
 *
 *  記帳本十幾個彈窗本來各自手刻同一段「onDelete ? 刪除 : <span />，右邊再放取消跟儲存」，
 *  連紅色刪除字的色碼都是各自複製的。集中成這一個，之後要調整按鈕順序或樣式只要改一次。 */
export function ModalFooter({
  onClose,
  onConfirm,
  confirmLabel = "儲存",
  confirmDisabled = false,
  onDelete,
  deleteLabel = "刪除",
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** 有給才顯示左下角的刪除；新增用的彈窗不給，位置用空元素佔著維持左右分佈。 */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <>
      {onDelete ? (
        <Button variant="ghost" className="text-[#D1517E] hover:text-[#D1517E]" onClick={onDelete}>
          {deleteLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
