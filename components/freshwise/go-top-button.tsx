"use client";

import { FaIcon } from "./fa-icon";
import { gradient, shadow } from "./theme";
import { scrollContainerToTop } from "@/lib/scroll-within";

/**
 * 「回到頂部」懸浮按鈕（行情頁、我的菜籃用）。
 *
 * `visible` 由呼叫端算，規則統一是「清單夠長就顯示」，不是「捲動超過某個距離才出現」——
 * 搜尋中／查無資料／空清單都不顯示，只要畫面上真的有一份偏長的清單可以捲，就讓使用者
 * 隨時能一鍵跳回頂端重新選條件，不用自己判斷捲多遠了。
 */
export function GoTopButton({ visible }: { visible: boolean }) {
  if (!visible) return null;

  function scrollToTop() {
    // 手機框容器本身有 transform，是這顆 fixed 按鈕的定位基準（不是瀏覽器視窗），
    // 所以捲動目標找卡片內部的 <main>，不是 window。
    const main = document.querySelector("main");
    if (main) scrollContainerToTop(main, "smooth");
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="回到頂部"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)", background: gradient.primary, boxShadow: shadow.cta }}
      className="fixed right-5 z-20 grid size-11 place-items-center rounded-full transition-opacity hover:opacity-90"
    >
      <FaIcon icon="arrow-up" size={18} className="text-white" />
    </button>
  );
}
