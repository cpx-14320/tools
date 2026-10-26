"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { SelectField } from "./select-field";
import { DateField } from "./date-field";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { InlineIcon } from "./icon-avatar";
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
/** 帳戶的圖示＋名稱；還沒選的話回傳 undefined，交給 SelectField 去顯示未選的提示。 */
function accountLabel(id: string, accounts: AccountDTO[], accountTypes: AccountTypeDTO[]) {
  const account = accounts.find((a) => a.id === id);
  if (!account) return undefined;
  const icon = accountTypeById(accountTypes, account.accountTypeId)?.icon ?? "";
  return (
    <span className="flex items-center gap-1.5">
      {icon && <InlineIcon icon={icon} />}
      {account.name}
    </span>
  );
}

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

  // 兩邊的帳戶選單都列出全部帳戶，不把對面選到的那個藏起來——藏起來的話，選完才發現
  // 「錢其實在另一個帳戶裡」時，那個帳戶已經從轉出的清單裡消失了，等於要重新整理才能改。
  // 選到跟對面同一個帳戶時直接對調兩邊，這也正好是使用者想做的事（轉錯方向）。
  function pickFrom(id: string) {
    if (id && id === toAccountId) setToAccountId(fromAccountId);
    setFromAccountId(id);
  }

  function pickTo(id: string) {
    if (id && id === fromAccountId) setFromAccountId(toAccountId);
    setToAccountId(id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯轉帳" : "新增轉帳"}
      stickyBottom={<AmountKeypad expr={expr} onExprChange={setExpr} label="轉帳金額" />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave({
              fromAccountId,
              toAccountId,
              amount: amountNum,
              date,
              note: note.trim() || undefined,
            })
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 轉出／轉入並排成一列：這兩欄是一組「從哪裡到哪裡」，上下排開反而要掃兩次才
          看得出方向；而且各佔一整列會把彈窗拉長到要捲動。 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="從（轉出帳戶）">
          <SelectField value={accountLabel(fromAccountId, accounts, accountTypes)} placeholder="選擇帳戶" onClick={() => setPickingFrom(true)} />
        </Field>
        <Field label="到（轉入帳戶）">
          <SelectField value={accountLabel(toAccountId, accounts, accountTypes)} placeholder="選擇帳戶" onClick={() => setPickingTo(true)} />
        </Field>
      </div>

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
        allowUnset={false}
        onClose={() => setPickingFrom(false)}
        onSelect={(id) => pickFrom(id ?? "")}
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
        allowUnset={false}
        onClose={() => setPickingTo(false)}
        onSelect={(id) => pickTo(id ?? "")}
      />
    </Modal>
  );
}
