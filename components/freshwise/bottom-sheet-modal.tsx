"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { colors } from "./theme";

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
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      {/* 這一層刻意複製手機框容器本身的版面公式（justify-center、px-0/sm:px-4、
          h-dvh／sm:h-[850px]），不是量測卡片位置來算座標——彈窗 portal 到 body 之後，
          單純的 fixed inset-0 只會貼齊瀏覽器視窗，貼不齊卡片。兩邊用同一套公式，不管
          視窗多大，算出來的框永遠跟卡片疊在一起。 */}
      <div className="relative flex h-full w-full justify-center px-0 py-0 sm:px-4 sm:py-6">
        <div className="flex h-dvh w-full max-w-[430px] items-end sm:h-[850px]">
          <div
            className={`flex max-h-[80%] w-full ${maxWidthClassName} flex-col overflow-y-auto rounded-t-[1.75rem] bg-white`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: colors.border }}>
              <p className="text-base font-semibold" style={{ color: colors.ink }}>
                {title}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="grid size-8 place-items-center rounded-full transition-colors hover:bg-[#EFF7F1]"
                style={{ color: colors.muted }}
              >
                ✕
              </button>
            </div>

            <div className={bodyClassName}>{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: colors.border }}>
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
