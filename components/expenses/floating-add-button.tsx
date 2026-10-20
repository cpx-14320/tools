"use client";

import { gradient, shadow } from "./theme";

/** 右下角的浮動「＋」新增鈕——首頁新增交易、消費分類、固定收支、帳戶、帳戶類型五個
 *  頁面都用這一顆。
 *
 *  fixed 的定位基準是外殼卡片（ExpensesMobileShell 的容器有 transform），不是整個瀏覽器
 *  視窗，所以 right-5 就直接貼齊卡片右緣；bottom 要再加上底部導覽列的高度跟手機的安全
 *  區域，不然會被導覽列蓋住。這幾個數字本來在五個頁面各複製一份，改成集中在這裡。 */
export function FloatingAddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-5 z-20 grid size-14 place-items-center rounded-full text-3xl font-bold leading-none text-white"
      style={{ background: gradient.primary, boxShadow: shadow.cta, bottom: "calc(env(safe-area-inset-bottom) + 86px)" }}
    >
      ＋
    </button>
  );
}
