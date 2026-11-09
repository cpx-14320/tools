"use client";

import { text } from "./theme";

/** 批次操作進行中的遮罩。
 *
 *  **為什麼需要**：批次改帳戶／改分類是逐筆送出的（一筆一個請求），選了二三十項時要跑
 *  好幾秒。沒有這塊的話，使用者按完「完成」看到的是一個沒反應的畫面，只能猜是不是當掉，
 *  然後再按一次。
 *
 *  **為什麼逐筆送而不是一次送完**：各個 API 本來就是一筆一個資源（分類的 PATCH、交易的
 *  bulk 是例外），而且逐筆送才有「做到第幾筆」可以回報。代價就是會花時間，所以更需要
 *  這塊遮罩。
 *
 *  蓋的範圍是整張手機卡片：外殼那層有 transform，fixed 子孫會以卡片為定位基準（跟底部
 *  導覽列、養成頁的彈窗同一招），所以不用 portal 也不會蓋到瀏覽器視窗外。 */
export function BusyOverlay({
  open,
  label = "處理中…",
  /** 做到第幾筆／總共幾筆。只有一筆的操作不用給，給了會多顯示一行進度。 */
  progress,
}: {
  open: boolean;
  label?: string;
  progress?: { done: number; total: number };
}) {
  if (!open) return null;

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    // aria-live：讀螢幕軟體要能知道「現在在處理」，不然畫面被蓋住卻沒有任何語音提示。
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2B1B46]/35" role="status" aria-live="polite">
      <div className="flex min-w-[180px] flex-col items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-[0_12px_32px_-12px_rgba(111,95,214,0.5)]">
        {/* 轉圈用純 CSS 畫（border 其中一邊透明 + animate-spin），不另外載圖或動畫庫。 */}
        <span aria-hidden className="size-7 animate-spin rounded-full border-[3px] border-[#EDE6FB] border-t-[#6F5ED4]" />
        <span className="text-sm font-medium text-[#4A3B7C]">{label}</span>
        {progress && progress.total > 1 && (
          <>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3EFFC]">
              <div className="h-full rounded-full bg-[#A9A5FF] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <span className={`tabular-nums ${text.faint}`}>
              {progress.done} / {progress.total}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
