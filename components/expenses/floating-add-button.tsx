"use client";

import type { ReactNode } from "react";
import { FaIcon } from "./fa-icon";
import { gradient, shadow } from "./theme";

/** 右下角的浮動「＋」新增鈕——首頁新增交易、消費分類、固定收支、帳戶、帳戶類型五個
 *  頁面都用這一顆。
 *
 *  尺寸、位置、陰影、漸層都比照搭乘車的「回到頂部」懸浮鈕（components/transit/
 *  go-top-button.tsx）：44px 圓鈕、right-5、底部避開導覽列 5.5rem，圖示用同一套
 *  Font Awesome 實心圖（那邊是 arrow-up，這邊是 plus），兩個工具的懸浮鈕才是同一個
 *  視覺語言。本來是一個 56px 的圓加一個全形「＋」文字，字體跟線條粗細都跟搭乘車對不上。
 *
 *  fixed 的定位基準是外殼卡片（ExpensesMobileShell 的容器有 transform），不是整個瀏覽器
 *  視窗，所以 right-5 就直接貼齊卡片右緣。 */
export function FloatingAddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-5 z-20 grid size-11 place-items-center rounded-full transition-opacity hover:opacity-90"
      style={{ background: gradient.primary, boxShadow: shadow.cta, bottom: FLOATING_BOTTOM }}
    >
      <FaIcon icon="plus" size={18} className="text-white" />
    </button>
  );
}

/** 主浮動鈕離底部多高（避開導覽列）。疊在它上面的次要鈕要照這個往上推。 */
const FLOATING_BOTTOM = "calc(env(safe-area-inset-bottom) + 5.5rem)";

/** 疊在主浮動鈕正上方的次要動作鈕（資產總表的「轉帳」）。
 *
 *  跟主鈕同一條垂直線、同樣 44px，但走白底細框而不是漸層實心——它是次要動作，
 *  兩顆都做成實心紫的話會分不出哪一顆是主要的「新增」。
 *  位置＝主鈕的高度（44px）再加 12px 間距，所以兩顆之間永遠等距，不用各自寫死數字。 */
export function FloatingSecondaryButton({
  icon,
  onClick,
  label,
  disabled = false,
}: {
  icon: ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="fixed right-5 z-20 grid size-11 place-items-center rounded-full border border-[#ECE4FA] bg-white text-[#6F5FD6] shadow-[0_8px_20px_-6px_rgba(111,95,214,0.35)] transition-opacity hover:opacity-90 disabled:text-[#C7BFE6] disabled:opacity-60"
      style={{ bottom: `calc(${FLOATING_BOTTOM} + 2.75rem + 0.75rem)` }}
    >
      {icon}
    </button>
  );
}
