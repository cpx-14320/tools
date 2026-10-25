"use client";

import { useState } from "react";
import { Modal, Field, ModalFooter } from "./modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { CategoryGridPicker } from "./category-grid-picker";
import { text } from "./theme";
import { reconcileAdjustment } from "@/lib/expenses/accounts";
import type { AccountKind } from "@/lib/expenses/account-types";
import { categoryPath, type CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency } from "@/lib/format";

/** 對帳：輸入帳戶的實際餘額（對一下銀行 App／錢包裡真正有多少），差額自動補成一筆
 *  調整交易，之後系統算出來的餘額就跟實際一致了。
 *
 *  差額要掛在某個分類底下才算得進統計，所以這裡要選分類——不自動建一個「帳務調整」
 *  分類，因為那會讓使用者的分類清單多出一個他沒建過的東西，而且「少記的錢到底算在
 *  哪一類」只有使用者自己知道（可能是忘了記的餐費，也可能是忘了記的利息收入）。 */
export function ReconcileModal({
  open,
  accountName,
  accountKind,
  currentBalance,
  categories,
  date,
  onClose,
  onSave,
}: {
  open: boolean;
  accountName: string;
  accountKind: AccountKind;
  currentBalance: number;
  categories: CategoryDTO[];
  /** 調整交易要記在哪一天，預設帶今天（由呼叫端決定，這個元件不讀時鐘）。 */
  date: string;
  onClose: () => void;
  /** 回傳 Promise 時 ModalFooter 會在送出期間鎖住儲存鍵——下面的 onConfirm 要記得把它
   *  return 出去，不然鎖會在 fetch 還沒回來前就解開，連點兩下會送出兩筆。 */
  onSave: (draft: { categoryId: string; amount: number; date: string; note: string }) => void | Promise<unknown>;
}) {
  const [expr, setExpr] = useState(String(currentBalance));
  const [categoryId, setCategoryId] = useState("");

  const actual = evaluateExpr(expr);
  const adjustment = Number.isFinite(actual) ? reconcileAdjustment(accountKind, currentBalance, actual) : null;
  const canSave = adjustment !== null && categoryId !== "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${accountName} 對帳`}
      fullHeight
      stickyBottom={<AmountKeypad expr={expr} onExprChange={setExpr} label="實際餘額" />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => {
            if (!adjustment) return;
            return onSave({ categoryId, amount: adjustment.amount, date, note: "對帳調整" });
          }}
          confirmDisabled={!canSave}
          confirmLabel="補上調整"
        />
      }
    >
      <div className="rounded-2xl bg-[#F9F7FE] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className={text.muted}>系統算出來的餘額</span>
          <span className="tabular-nums font-semibold text-[#4A3B7C]">{formatCurrency(currentBalance)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={text.muted}>你輸入的實際餘額</span>
          <span className="tabular-nums font-semibold text-[#4A3B7C]">{formatCurrency(Number.isFinite(actual) ? actual : 0)}</span>
        </div>
        <div className="mt-3 border-t border-[#ECE4FA] pt-3 text-sm">
          {adjustment === null ? (
            <p className="text-[#2FAE82]">兩邊一致，不需要調整 🎉</p>
          ) : (
            <p className="text-[#4A3B7C]">
              差額會補成一筆
              <span className="font-semibold">{adjustment.kind === "收入" ? "收入" : "支出"}</span>
              <span className="ml-1 font-semibold tabular-nums">{formatCurrency(adjustment.amount)}</span>
            </p>
          )}
        </div>
      </div>

      {adjustment !== null && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={text.label}>這筆調整算在哪一類</span>
            {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
          </div>
          <CategoryGridPicker categories={categories} kind={adjustment.kind} value={categoryId} onChange={setCategoryId} />
        </div>
      )}

      <Field label="日期">
        <p className={text.body}>{date}</p>
      </Field>
    </Modal>
  );
}
