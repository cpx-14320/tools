"use client";

import { FaIcon } from "./fa-icon";
import { scrollContainerToTop } from "@/lib/scroll-within";

/**
 * 搜尋結果頁、Ubike、我的行程共用的「回到頂部」懸浮按鈕——以前三個地方各自複製貼上
 * 同一份 JSX（連註解都一樣），現在只有這一份實作。
 *
 * `visible` 由呼叫端算：規則統一是「清單非空就顯示」，不是「捲動超過某個距離才出現」
 * 那種常見模式——查詢中／查無資料／還沒輸入條件都不顯示，只要畫面上真的有一份可能
 * 偏長的清單可以捲，就讓使用者隨時能一鍵跳回頂端重新選條件，不用自己判斷「捲多遠了」。
 */
export function GoTopButton({ visible }: { visible: boolean }) {
  if (!visible) return null;

  function scrollToTop() {
    // TransitMobileShell 的卡片容器本身有 transform，是這個 fixed 按鈕的定位基準
    // （不是整個瀏覽器視窗），所以捲動目標找卡片內部的 <main>，不是 window。
    const main = document.querySelector("main");
    if (main) scrollContainerToTop(main, "smooth");
  }

  return (
    // right-5／bottom 直接貼齊卡片邊界（理由同上，transform 容器已經是定位基準），
    // 不用再額外包一層 mx-auto + max-w-[430px] 去手動對齊寬度；bottom 的偏移量避開
    // 貼在卡片底部的導覽列。
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="回到頂部"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)", background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
      className="fixed right-5 z-20 grid size-11 place-items-center rounded-full shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)] transition-opacity hover:opacity-90"
    >
      <FaIcon icon="arrow-up" size={18} className="text-white" />
    </button>
  );
}
