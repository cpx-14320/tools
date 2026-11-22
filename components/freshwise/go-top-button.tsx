"use client";

import { IllustratedArt } from "./game-art";
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
    <>
      {/* 這顆是 fixed 的，不佔版面高度，所以清單最後一列會被它蓋住（行情頁蓋到種子袋
          按鈕、菜籃頁蓋到價格）。呼叫端都是把它放在頁面最後，就由它自己補一塊等高的
          佔位，捲到底時最後一列還是點得到。 */}
      <div aria-hidden className="h-12 shrink-0" />
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="回到頂部"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 88px)" }}
        className="fw-go-top fixed right-5 z-20 grid place-items-center transition-opacity hover:opacity-90"
      >
        {/* 插畫版的回到頂端。圖檔放 public/freshwise/ui-go-top.png（跟其他介面圖示
            同一層、同一個 ui- 前綴）。 */}
        <IllustratedArt src="/freshwise/ui-go-top.png" size={44} />
      </button>
    </>
  );
}
