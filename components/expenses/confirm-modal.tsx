"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAsyncAction } from "./use-async-action";
import { Button } from "./button";
import { Modal, fieldInputClass } from "./modal";
import { text } from "./theme";

/** 共用的「確定要刪除嗎」彈窗——取代瀏覽器原生的 `confirm()`。整個記帳本所有會刪東西的
 *  地方（分類、帳戶、帳戶類型、目標、固定收支、轉帳、批次多選刪除…）都共用這一個，
 *  樣式跟行為才會一致，不用每個刪除按鈕各自手刻一次「真的要刪除嗎」的提示。 */
export function ConfirmModal({
  open,
  title = "確定要刪除嗎？",
  message,
  confirmLabel = "刪除",
  cancelLabel = "取消",
  danger = true,
  /** 純粹告知、沒有「確定」這個動作可選時用（例如類型還有帳戶在用、不能刪除）——
   *  只留一顆按鈕關掉彈窗，不顯示「取消」。 */
  onlyAcknowledge = false,
  /** 要使用者照著打一次這段文字才能按確認——清空整個記帳本這種沒有還原機制的操作用，
   *  避免手滑點兩下就把資料全砍了。 */
  requireText,
  /** 確認之外的附加選項（清除資料時的「一併清除養成進度」）——不是另開一個彈窗問第二次，
   *  使用者本來就在決定「要清掉什麼」，範圍的選擇就該在同一個畫面上。 */
  option,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 大部分情境都是刪除（紅色強調），少數「只是會解除連動」這種非破壞性確認可以傳 false。 */
  danger?: boolean;
  onlyAcknowledge?: boolean;
  requireText?: string;
  option?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
  onConfirm?: () => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  // 確認鍵要擋連點，而且要**等 onConfirm 做完才關窗**。
  //
  // 本來是 `onConfirm(); onClose();` ——不 await 也不擋重複：手快點兩下就送出兩次
  // （彈窗要等重繪才消失，中間那一瞬間按得到），而且 onConfirm 多半是非同步的，
  // 失敗了彈窗早就關掉，使用者只看到「什麼都沒發生」。
  const confirmAction = useAsyncAction(async () => {
    await onConfirm?.();
    onClose();
  });

  // 每次重新打開都把輸入框清空，不然上一次打過的確認文字會留著，等於沒擋到。
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    if (open) setTyped("");
  }, [open]);

  const canConfirm = !requireText || typed.trim() === requireText;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          {!onlyAcknowledge && (
            <Button variant="ghost" onClick={onClose}>
              {cancelLabel}
            </Button>
          )}
          <Button
            disabled={!canConfirm || confirmAction.busy}
            onClick={confirmAction.run}
            className={danger && !onlyAcknowledge ? "!shadow-none" : undefined}
            style={danger && !onlyAcknowledge ? { background: "#D1517E" } : undefined}
          >
            {onlyAcknowledge ? "知道了" : confirmAction.busy ? "處理中…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className={`${text.body} leading-relaxed`}>{message}</p>
      {option && (
        <label className="flex items-start gap-2.5 rounded-2xl bg-[#F9F7FE] px-4 py-3">
          <input
            type="checkbox"
            checked={option.checked}
            onChange={(e) => option.onChange(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#6F5ED4]"
          />
          <span className={text.body}>{option.label}</span>
        </label>
      )}
      {requireText && (
        <label className="flex flex-col gap-1.5">
          <span className={text.label}>
            確認請輸入「{requireText}」
          </span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={requireText} className={fieldInputClass} />
        </label>
      )}
    </Modal>
  );
}
