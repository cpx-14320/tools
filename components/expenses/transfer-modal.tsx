"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountPickerModal } from "./account-picker-modal";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TransferModalDraft {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  note?: string;
}

/** 資產帳戶之間搬錢（提款存進戶頭、信用卡還款……）——跟一般消費紀錄是兩回事：不選
 *  分類，不算進支出/收入統計，只影響轉出/轉入這兩個帳戶各自的餘額（見 accounts.ts
 *  的 accountBalance）。比照新增交易彈窗同一套「主彈窗＋最多一層」原則：轉出/轉入
 *  帳戶各自用同一個 AccountPickerModal（唯一允許的第二層），金額用共用的小算盤，
 *  不再另外跳窗。 */
export function TransferModal({
  open,
  accounts,
  accountTypes,
  transactions,
  categories,
  transfers,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  transfers: TransferDTO[];
  initial?: TransferDTO;
  onClose: () => void;
  onSave: (draft: TransferModalDraft) => void;
  onDelete?: () => void;
}) {
  const [fromAccountId, setFromAccountId] = useState(initial?.fromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState(initial?.toAccountId ?? "");
  const [expr, setExpr] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [pickingFrom, setPickingFrom] = useState(false);
  const [pickingTo, setPickingTo] = useState(false);

  const amountNum = evaluateExpr(expr);
  const canSave = !!fromAccountId && !!toAccountId && fromAccountId !== toAccountId && Number.isFinite(amountNum) && amountNum > 0 && !!date;

  function accountLabel(id: string): string {
    const a = accounts.find((acc) => acc.id === id);
    if (!a) return "";
    return `${accountTypeById(accountTypes, a.accountTypeId)?.icon ?? ""} ${a.name}`;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯轉帳" : "新增轉帳"}
      footer={
        <>
          {onDelete ? (
            <Button variant="ghost" className="text-[#D1517E] hover:text-[#D1517E]" onClick={onDelete}>
              刪除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => onSave({ fromAccountId, toAccountId, amount: amountNum, date, note: note.trim() || undefined })}
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="從（轉出帳戶）">
        <button type="button" onClick={() => setPickingFrom(true)} className={`${fieldInputClass} text-left`}>
          <span className={fromAccountId ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}>
            {fromAccountId ? accountLabel(fromAccountId) : "選擇帳戶"}
          </span>
        </button>
      </Field>

      <p aria-hidden className="text-center text-[#C7BFE6]">
        ↓
      </p>

      <Field label="到（轉入帳戶）">
        <button type="button" onClick={() => setPickingTo(true)} className={`${fieldInputClass} text-left`}>
          <span className={toAccountId ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}>{toAccountId ? accountLabel(toAccountId) : "選擇帳戶"}</span>
        </button>
      </Field>

      <AmountKeypad expr={expr} onExprChange={setExpr} color="#6F5FD6" />

      <Field label="日期">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="備註（可不填）">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>

      <AccountPickerModal
        open={pickingFrom}
        title="選擇轉出帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        value={fromAccountId || undefined}
        excludeAccountId={toAccountId || undefined}
        allowUnset={false}
        onClose={() => setPickingFrom(false)}
        onSelect={(id) => setFromAccountId(id ?? "")}
      />
      <AccountPickerModal
        open={pickingTo}
        title="選擇轉入帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        value={toAccountId || undefined}
        excludeAccountId={fromAccountId || undefined}
        allowUnset={false}
        onClose={() => setPickingTo(false)}
        onSelect={(id) => setToAccountId(id ?? "")}
      />
    </Modal>
  );
}
