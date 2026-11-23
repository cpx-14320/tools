"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors, v } from "./theme";

/** 這個工具所有彈窗的共用外殼：手機寬度從底部彈出、桌面寬度對齊手機框，標題列＋關閉鈕
 *  在上、內容在中間、可選的 footer 在下。
 *
 *  用 createPortal 掛到 document.body，不是畫在呼叫端的 DOM 位置——外層的手機框容器
 *  （FreshwiseMobileShell）本身有 transform，會把底下所有 position:fixed 的子孫收進同一個
 *  堆疊脈絡；實測在部分手機瀏覽器上這種「transform 容器 ＋ 多層 fixed 子孫」的疊圖順序
 *  不可靠，彈窗會被底部導覽列蓋住。掛到 body 之後疊圖順序只看自己的 z-index。
 *
 *  （這份跟 components/transit/bottom-sheet-modal.tsx 是刻意的各自一份：行為一樣，但色票
 *  不同，而且兩個工具的彈窗以後各自會長出不一樣的需求。共用一份就得開始傳色票參數，那會
 *  讓兩邊都變難改。） */
export function BottomSheetModal({
  open,
  title,
  onClose,
  children,
  footer,
  // 跟 FreshwiseMobileShell 的 max-w-[430px] 對齊。這個彈窗 portal 到 body、脫離卡片的
  // transform 定位脈絡，不會自動跟著卡片寬度縮放，要手動對齊同一個數字。
  maxWidthClassName = "max-w-[430px]",
  bodyClassName = "flex flex-col gap-4 px-5 py-5",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  /** 需要自己控制版面（例如滿版的清單）時傳自己的 class 覆蓋預設的留白。 */
  bodyClassName?: string;
}) {
  // createPortal 需要 document，SSR 時還沒有，掛載後才真的 portal 出去。
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const closeCallback = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeCallback.current = onClose; }, [onClose]);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = dialog.current;
    panel?.focus();
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('.fw-modal-paper');
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (event.key === 'Escape') { event.preventDefault(); closeCallback.current(); }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]') ?? []).filter((element) => element.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); panel?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fw-modal fixed inset-0" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="fw-modal-backdrop absolute inset-0" />
      {/* 這一層刻意複製手機框容器本身的版面公式（justify-center、px-0/sm:px-4、
          h-dvh／sm:h-[850px]），不是量測卡片位置來算座標——彈窗 portal 到 body 之後，
          單純的 fixed inset-0 只會貼齊瀏覽器視窗，貼不齊卡片。兩邊用同一套公式，不管
          視窗多大，算出來的框永遠跟卡片疊在一起。 */}
      <div className="fw-modal-align relative flex h-full w-full justify-center">
        <div className="fw-modal-frame flex w-full max-w-[430px] items-end">
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`fw-modal-paper flex max-h-[90%] w-full ${maxWidthClassName} flex-col overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div data-modal-heading className="flex shrink-0 items-center justify-between">
              <p id={titleId} data-modal-title className="font-semibold" style={{ color: colors.ink, fontSize: v.fsSection }}>
                {title}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="fw-modal-close grid place-items-center rounded-full transition-colors hover:bg-[#F6EEDB]"
                style={{ width: 44, height: 44, fontSize: v.fsPage, color: colors.muted }}
              >
                ✕
              </button>
            </div>

            {/* 只有中間這一層捲動，標題與 footer 固定住——整張紙一起捲的話，使用者
                往下看選項時「關閉」與「確定」都會捲出畫面。捲軸隱藏（.fw-modal-scroll）：
                彈窗寬度就這麼窄，一條系統捲軸會壓掉一整欄內容。
                外層再包一層的理由是 flex 子項目預設 min-height:auto、不會縮，捲動要發生
                在一個「自己不長高」的容器上；呼叫端自己的版面維持原樣放在裡面。 */}
            <div className="fw-modal-scroll">
              <div className={bodyClassName}>{children}</div>
            </div>

            {footer && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: colors.border }}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
