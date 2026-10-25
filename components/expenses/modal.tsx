"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
        {/* max-h-dvh：sm 以上固定 850px 高是為了模擬手機卡片，但瀏覽器視窗比 850 矮時
            （筆電常見）彈窗會長到畫面外、「儲存」按不到，而且外層沒有捲軸可以捲下去。 */}
        <div className="flex h-dvh max-h-dvh w-full max-w-[430px] items-end sm:h-[850px]">
          <div
            // 滿版的彈窗不要上圓角：圓角切掉的那兩個角會透出底下那層的顏色，看起來像
            // 沒蓋滿。只有半高的彈窗需要圓角，那是它「從下面滑上來」的視覺。
            className={`flex w-full flex-col overflow-hidden bg-white ${fullHeight ? "h-full max-h-full" : "max-h-[80%] rounded-t-[1.75rem]"}`}
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
 *  連紅色刪除字的色碼都是各自複製的。集中成這一個，之後要調整按鈕順序或樣式只要改一次。
 *
 *  儲存鍵自己防連點：onConfirm 多半是「打 API →（成功才）關彈窗」的非同步流程，在回應
 *  回來之前按鈕還是能按的，手快點兩下就會送出兩筆一模一樣的資料。這裡在送出期間把它
 *  鎖住——用 ref 擋同一個 tick 內的第二次點擊（state 要等重繪才生效，擋不住），state
 *  只負責讓按鈕變成不能按的樣子。 */
export function ModalFooter({
  onClose,
  onConfirm,
  confirmLabel = "儲存",
  confirmDisabled = false,
  onDelete,
  deleteLabel = "刪除",
}: {
  onClose: () => void;
  /** 回傳 Promise 的話（呼叫端的 onSave 是 async function 就會是），送出期間儲存鍵會
   *  鎖住，等它結束才解鎖。 */
  onConfirm: () => void | Promise<unknown>;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** 有給才顯示左下角的刪除；新增用的彈窗不給，位置用空元素佔著維持左右分佈。 */
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function handleConfirm() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

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
        <Button disabled={confirmDisabled || saving} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
