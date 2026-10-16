"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
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
            className="flex max-h-[80%] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white"
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

            {/* 標題跟 footer 固定不動，只有這一段內容自己捲動——不然表單一長，連「取消／
                儲存」都會被捲出畫面外。 */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">{children}</div>

            {footer && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#ECE4FA] px-5 py-4">{footer}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
