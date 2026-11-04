"use client";

import { useState } from "react";
import { FloatingSecondaryButton } from "../floating-add-button";
import { AiComposeModal } from "./ai-compose-modal";
import { AiKeyModal } from "./ai-key-modal";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";

/** AI 記帳的入口——疊在「新增收支紀錄」那顆＋上面（跟資產總表的「轉帳」疊在「新增帳戶」
 *  上面同一招）。
 *
 *  **整個 AI 功能對外只有這一顆元件跟設定頁那一列**：想拿掉的話，刪掉呼叫端那一行 JSX
 *  再刪 components/expenses/ai/ 整個資料夾就乾淨了，其他頁面的程式碼不用動。
 *
 *  `enabled` 由伺服器決定（見 lib/expenses/settings.server.ts）——預設關閉，沒開的人
 *  版面上完全看不到它，也不會載入底下那兩個彈窗。手動記帳那條路完全不受影響。 */
export function AiEntryButton({
  enabled,
  categories,
  onCommitted,
}: {
  enabled: boolean;
  categories: CategoryDTO[];
  onCommitted: (transactions: TransactionDTO[]) => void;
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <FloatingSecondaryButton icon={<span className="text-sm font-bold">AI</span>} label="用 AI 記一筆" onClick={() => setComposeOpen(true)} />
      <AiComposeModal
        open={composeOpen}
        categories={categories}
        onClose={() => setComposeOpen(false)}
        onCommitted={onCommitted}
        onOpenKeyModal={() => setKeyOpen(true)}
      />
      <AiKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
    </>
  );
}
