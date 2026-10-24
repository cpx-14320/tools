"use client";

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
      style={{ background: gradient.primary, boxShadow: shadow.cta, bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <FaIcon icon="plus" size={18} className="text-white" />
    </button>
  );
}
