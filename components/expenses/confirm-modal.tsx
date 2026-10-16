"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Modal } from "./modal";
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
  onConfirm?: () => void;
  onClose: () => void;
}) {
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
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={danger && !onlyAcknowledge ? "!shadow-none" : undefined}
            style={danger && !onlyAcknowledge ? { background: "#D1517E" } : undefined}
          >
            {onlyAcknowledge ? "知道了" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className={`${text.body} leading-relaxed`}>{message}</p>
    </Modal>
  );
}
