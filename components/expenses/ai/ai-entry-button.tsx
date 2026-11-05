"use client";

import { useState } from "react";
import { FloatingSecondaryButton } from "../floating-add-button";
import { AiComposeModal } from "./ai-compose-modal";
import { AiKeyModal } from "./ai-key-modal";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransferDTO } from "@/lib/expenses/transfers";

/** AI 記帳的入口——疊在「新增收支紀錄」那顆＋上面（跟資產總表的「轉帳」疊在「新增帳戶」
 *  上面同一招）。
 *
 *  **整個 AI 功能對外只有這一顆元件跟設定頁那一列**：想拿掉的話，刪掉呼叫端那一行 JSX
 *  再刪 components/expenses/ai/ 整個資料夾就乾淨了，其他頁面的程式碼不用動。
 *
 *  `enabled` 由伺服器決定（見 lib/expenses/settings.server.ts）——預設關閉，沒開的人
 *  版面上完全看不到它，也不會載入底下那兩個彈窗。手動記帳那條路完全不受影響。
 *
 *  要這麼多份資料是因為待確認區的編輯用的是記帳本原本那個新增／編輯彈窗（分類、帳戶、
 *  日期、金額全都能改）。呼叫的兩個頁面本來就讀好這些了，不用額外再查一次。 */
export function AiEntryButton({
  enabled,
  categories,
  accounts,
  accountTypes,
  transactions,
  transfers,
  onCommitted,
  onCategoriesChange,
}: {
  enabled: boolean;
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  onCommitted: (transactions: TransactionDTO[]) => void;
  onCategoriesChange: (categories: CategoryDTO[]) => void;
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
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        onClose={() => setComposeOpen(false)}
        onCommitted={onCommitted}
        onCategoriesChange={onCategoriesChange}
        onOpenKeyModal={() => setKeyOpen(true)}
      />
      <AiKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
    </>
  );
}
