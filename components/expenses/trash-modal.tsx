"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { ListCard } from "./list-row";
import { ConfirmModal } from "./confirm-modal";
import { text } from "./theme";
import { useToast } from "./toast";
import { useAsyncAction } from "./use-async-action";
import { TRASH_KIND_LABEL, type TrashItemDTO } from "@/lib/expenses/trash";
import { formatDate } from "@/lib/format";

/** 設定頁的「最近刪除」。
 *
 *  **沒有自動過期**：這些是使用者自己記了很久的資料，時間到了自己消失會嚇到人，而且
 *  「我以為還在」比「垃圾桶有點滿」糟得多。只能由使用者自己按「永久刪除」或「清空」。
 *
 *  還原的三種結果（正常、撞名被改名、原本的帳戶已不在）都會用提示講清楚——後兩種不是
 *  錯誤，但使用者需要知道東西回來之後長得跟原本不太一樣。 */
export function TrashModal({
  open,
  items,
  onClose,
  onItemsChange,
  onRestored,
}: {
  open: boolean;
  items: TrashItemDTO[];
  onClose: () => void;
  onItemsChange: (items: TrashItemDTO[]) => void;
  /** 還原之後呼叫端可能要重抓自己的清單（設定頁沒有需要跟著更新的東西，所以是選填）。 */
  onRestored?: () => void;
}) {
  const showToast = useToast();
  const [purgeTarget, setPurgeTarget] = useState<TrashItemDTO | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);

  async function post(body: Record<string, unknown>) {
    const data: { items?: TrashItemDTO[]; error?: string; renamedTo?: string; droppedRefs?: number; deleted?: number } = await fetch(
      "/api/expenses/trash",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    )
      .then((r) => r.json())
      .catch(() => ({ error: "操作失敗，再試一次" }));
    if (data.items) onItemsChange(data.items);
    return data;
  }

  const restore = useAsyncAction(async (item: TrashItemDTO) => {
    const data = await post({ action: "restore", id: item.id });
    if (data.error) {
      showToast(data.error);
      return;
    }
    onRestored?.();
    if (data.renamedTo) showToast(`已還原，因為名稱重複所以改成「${data.renamedTo}」`);
    else if (data.droppedRefs) showToast("已還原，但原本掛的帳戶已經不在了");
    else showToast("已還原");
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="最近刪除"
        fullHeight
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => setEmptyOpen(true)}
              className="text-xs font-medium text-[#D1517E] disabled:opacity-40"
            >
              清空垃圾桶
            </button>
            <Button variant="ghost" onClick={onClose}>
              關閉
            </Button>
          </div>
        }
      >
        {items.length === 0 ? (
          <p className={`px-1 ${text.faint}`}>目前沒有已刪除的項目。</p>
        ) : (
          <>
            <p className={`${text.muted} leading-relaxed`}>刪掉的項目會一直留在這裡，直到你自己清掉為止，不會自動消失。</p>
            <ListCard>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${text.body}`}>{item.label}</p>
                    <p className={text.muted}>
                      {TRASH_KIND_LABEL[item.kind]}
                      {item.sublabel ? ` · ${item.sublabel}` : ""}
                      {/* 一次刪除連帶移除好幾個文件時講明白（刪分類會連子分類一起）。 */}
                      {item.docCount > 1 ? ` · 共 ${item.docCount} 項` : ""}
                    </p>
                    <p className={text.faint}>{formatDate(item.deletedAt.slice(0, 10))} 刪除</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPurgeTarget(item)}
                    className="shrink-0 text-xs font-medium text-[#9C94C4]"
                  >
                    永久刪除
                  </button>
                  <button
                    type="button"
                    disabled={restore.busy}
                    onClick={() => restore.run(item)}
                    className="shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1 text-xs font-medium text-[#6F5FD6] disabled:opacity-40"
                  >
                    還原
                  </button>
                </div>
              ))}
            </ListCard>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={purgeTarget !== null}
        title="永久刪除"
        message={`「${purgeTarget?.label ?? ""}」會從垃圾桶裡徹底移除，之後沒有辦法再還原。`}
        confirmLabel="永久刪除"
        onConfirm={async () => {
          if (purgeTarget) await post({ action: "purge", id: purgeTarget.id });
        }}
        onClose={() => setPurgeTarget(null)}
      />

      <ConfirmModal
        open={emptyOpen}
        title="清空垃圾桶"
        message={`垃圾桶裡的 ${items.length} 項會全部徹底移除，之後沒有辦法再還原。`}
        confirmLabel="全部清空"
        requireText="清空垃圾桶"
        onConfirm={async () => {
          const data = await post({ action: "empty" });
          if (data.deleted !== undefined) showToast(`已清空 ${data.deleted} 項`);
        }}
        onClose={() => setEmptyOpen(false)}
      />
    </>
  );
}
