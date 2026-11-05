"use client";

import { useToast } from "./toast";

/** 刪除之後跳一個帶「復原」的提示。
 *
 *  復原 ＝ 從垃圾桶把那幾項還原回來（見 lib/expenses/trash.server.ts）。所以這顆按鈕
 *  不是另一套機制，只是垃圾桶的一個快捷方式——錯過了提示還是可以去「設定 › 最近刪除」
 *  找回來，不會因為手慢就真的沒了。
 *
 *  **批次刪除一樣給得了「復原」**：一次刪 N 筆就是 N 個垃圾桶項目，按鈕把它們全部還原
 *  就好。本來想說「一顆按鈕救不回 N 個」而跳過，但那是實作上的偷懶不是道理——使用者
 *  的心智模型是「我剛剛刪了一批」，復原就該把那一批拿回來。
 *
 *  `onRestored` 把還原後的最新清單交回呼叫端更新畫面。這裡刻意不自己重抓：每個頁面
 *  需要的清單不一樣（交易、轉帳、目標、規則…），由呼叫端決定抓什麼最省。 */
export function useUndoDelete() {
  const showToast = useToast();

  /** @param trashIds 刪除 API 回傳的垃圾桶項目 id；一個都沒有就只顯示一般的提示。 */
  return function showDeleteToast(
    trashIds: (string | undefined)[] | string | undefined,
    onRestored: () => void | Promise<unknown>,
    message = "已刪除",
  ) {
    const ids = (Array.isArray(trashIds) ? trashIds : [trashIds]).filter((id): id is string => !!id);
    if (ids.length === 0) {
      showToast(message);
      return;
    }
    showToast(message, {
      label: "復原",
      onAction: async () => {
        // 逐筆依序還原，不是併發：還原分類時會去改交易的 categoryId，兩個請求同時進來
        // 改同一批交易的結果不保證。順序做完最後的狀態才是對的。
        let renamedTo: string | undefined;
        let droppedRefs = 0;
        let failed = 0;
        for (const id of ids) {
          const data: { error?: string; renamedTo?: string; droppedRefs?: number } = await fetch("/api/expenses/trash", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "restore", id }),
          })
            .then((r) => r.json())
            .catch(() => ({ error: "復原失敗" }));
          if (data.error) failed++;
          if (data.renamedTo) renamedTo = data.renamedTo;
          droppedRefs += data.droppedRefs ?? 0;
        }
        await onRestored();

        // 還原時可能動過兩件事，都要讓使用者知道，不要默默改掉。
        if (failed === ids.length) showToast("復原失敗，到「設定 › 最近刪除」看看");
        else if (failed > 0) showToast(`復原了 ${ids.length - failed} 項，有 ${failed} 項失敗`);
        else if (renamedTo) showToast(`已復原，因為名稱重複所以改成「${renamedTo}」`);
        else if (droppedRefs) showToast("已復原，但原本掛的帳戶已經不在了");
        else showToast(ids.length > 1 ? `已復原 ${ids.length} 項` : "已復原");
      },
    });
  };
}
