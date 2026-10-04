"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 出發站／抵達站／日期／時間這類小彈窗共用的外殼：手機寬度從底部彈出、桌面寬度置中，
 *  標題列＋關閉鈕在上、內容在中間、可選的 footer（取消／儲存這類按鈕）在下。
 *
 *  用 createPortal 掛到 document.body，不是直接畫在呼叫端的 DOM 位置——首頁卡片容器
 *  （DreamMobileShell）本身有 transform，會讓底下所有 position:fixed 的子孫（包含這個
 *  彈窗跟底部導覽列）都被收進同一個堆疊脈絡裡；z-index 照理說應該能分出誰在上面，但實測
 *  在部分手機瀏覽器上這種「transform 容器 + 多層 fixed 子孫」的疊圖順序不可靠，彈窗會被
 *  導覽列蓋住。掛到 document.body 之後這個彈窗完全脫離那個 transform 脈絡，疊圖順序只看
 *  自己的 z-index，不會再被牽連。 */
export function BottomSheetModal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-[400px]",
  bodyClassName = "flex flex-col gap-4 px-5 py-5",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  /** 大部分彈窗內容是「垂直排列、有留白」的表單欄位，用預設值就好；像雙欄站點清單這種
   *  需要自己控制版面（不要外層硬塞 padding）的內容，傳自己的 class 覆蓋。 */
  bodyClassName?: string;
}) {
  // createPortal 需要 document 存在，伺服器端渲染時還沒有，掛載後才真的 portal 出去，
  // 避免 SSR／CSR 的輸出不一致。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // 掛載後才翻成 true 是故意的一次性初始化（讓 createPortal 等到真的有 document 可用
    // 才執行），不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className={`flex max-h-[85vh] w-full ${maxWidthClassName} flex-col overflow-y-auto rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">{title}</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer && <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
