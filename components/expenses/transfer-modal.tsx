"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { text } from "./theme";
import { SelectField } from "./select-field";
import { DateField } from "./date-field";
import { AmountField, AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountPickerModal } from "./account-picker-modal";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
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
  /** 跨行轉帳被扣的手續費，可不填。不是轉帳金額的一部分——它會另外變成一筆掛在
   *  「手續費」分類、從轉出帳戶出去的支出（見 transfers.server.ts）。 */
  fee?: number;
}

/** 資產帳戶之間搬錢（提款存進戶頭、信用卡還款……）——跟一般消費紀錄是兩回事：不選
 *  分類，不算進支出/收入統計，只影響轉出/轉入這兩個帳戶各自的餘額（見 accounts.ts
 *  的 accountBalance）。比照新增交易彈窗同一套「主彈窗＋最多一層」原則：轉出/轉入
 *  帳戶各自用同一個 AccountPickerModal（唯一允許的第二層），金額用共用的小算盤，
 *  不再另外跳窗。 */
/** 選到的帳戶名稱；還沒選的話回傳 undefined，交給 SelectField 去顯示未選的提示。
 *
 *  刻意只有文字、不帶類型圖示：這兩格是並排的窄欄位（從／到各佔一半），圖示一擺進去
 *  帳戶名稱就只剩幾個字的寬度，稍長一點的名字直接被截掉。要認是哪個帳戶靠的是名字，
 *  圖示在這裡幫不上忙——點進去的帳戶選擇彈窗裡才有圖示可以看。 */
function accountLabel(id: string, accounts: AccountDTO[]) {
  return accounts.find((a) => a.id === id)?.name;
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
  const [feeExpr, setFeeExpr] = useState(initial?.fee ? String(initial.fee) : "");
  // 下方那個固定小鍵盤同時服務「轉帳金額」跟「手續費」兩欄，target 記著現在在編哪一個
  // ——跟新增交易、存錢目標彈窗同一套做法，不要讓其中一欄跳原生數字鍵盤。
  const [target, setTarget] = useState<"amount" | "fee">("amount");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [pickingFrom, setPickingFrom] = useState(false);
  const [pickingTo, setPickingTo] = useState(false);

  const amountNum = evaluateExpr(expr);
  const feeNum = evaluateExpr(feeExpr);
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
      // 滿版：轉出／轉入／日期／備註四欄加上底下固定的小鍵盤，80% 高度時備註欄會被
      // 鍵盤壓掉一半。跟新增帳戶、新增交易一致。
      fullHeight
      stickyBottom={
        <AmountKeypad
          expr={target === "amount" ? expr : feeExpr}
          onExprChange={target === "amount" ? setExpr : setFeeExpr}
          label={target === "amount" ? "轉帳金額" : "手續費"}
          // 手續費留空就是沒有手續費，是合理答案，所以只有轉帳金額是必填。
          required={target === "amount"}
        />
      }
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
              fee: Number.isFinite(feeNum) && feeNum > 0 ? feeNum : undefined,
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
        <Field label="從（轉出帳戶）" required>
          <SelectField value={accountLabel(fromAccountId, accounts)} placeholder="選擇帳戶" onClick={() => setPickingFrom(true)} />
        </Field>
        <Field label="到（轉入帳戶）" required>
          <SelectField value={accountLabel(toAccountId, accounts)} placeholder="選擇帳戶" onClick={() => setPickingTo(true)} />
        </Field>
      </div>

      {/* 兩個金額欄位都擺出來，鍵盤跟著點到的那一欄走。轉帳金額本來只在鍵盤上，加了
          手續費之後就非得有一個「切回去編轉帳金額」的入口。 */}
      <AmountField label="轉帳金額" required value={amountNum} active={target === "amount"} onFocus={() => setTarget("amount")} placeholder="" />
      <AmountField label="手續費" value={feeNum} active={target === "fee"} onFocus={() => setTarget("fee")} placeholder="沒有就留空" />
      <p className={`-mt-1 ${text.faint}`}>
        跨行轉帳、ATM 提款被扣的錢。轉帳本身不影響淨資產，但手續費是真的花掉了，所以會另外記一筆掛在「手續費」分類的支出，從轉出帳戶扣。
      </p>

      <Field label="日期" required>
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="備註">
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
