"use client";

import { useState } from "react";
import { Modal, Field, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { text } from "./theme";
import type { CategoryDTO } from "@/lib/expenses/categories";

/** 設定某個分類「從某個月起」的預算。
 *
 *  生效月份在這裡選，不是在頁面最上面選一個全域的月份再回頭套用到每個分類——預算本來
 *  就是一個分類一個分類決定的（「餐飲從三月起多編一點」跟交通無關），全域月份會讓人
 *  以為那是「在看哪個月」而不是「要從哪個月開始改」。
 *
 *  這個分類已經設過的那幾筆列在頁面上分類名稱的下方（見 BudgetsView），不在這裡重複。 */
export function BudgetModal({
  open,
  category,
  initialYearMonth,
  currentAmount,
  onClose,
  onSave,
}: {
  open: boolean;
  category: CategoryDTO | null;
  /** 生效月份的預設值；編輯既有的那一筆時帶它自己的月份。 */
  initialYearMonth: string;
  /** 金額輸入框的預設值。 */
  currentAmount: number;
  onClose: () => void;
  onSave: (yearMonth: string, amount: number) => void | Promise<unknown>;
}) {
  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [expr, setExpr] = useState(currentAmount > 0 ? String(currentAmount) : "");
  const amount = evaluateExpr(expr);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `${category.name} 的預算` : "設定預算"}
      stickyBottom={<AmountKeypad expr={expr} onExprChange={setExpr} label="每月預算" />}
      footer={
        <ModalFooter
          onClose={onClose}
          // return 不能省：onSave 是非同步的，把 Promise 交回 ModalFooter 才會在送出
          // 期間鎖住儲存鍵（見 category-batch-modal.tsx 同一個坑）。
          onConfirm={() => onSave(yearMonth, amount)}
          confirmDisabled={!Number.isFinite(amount) || amount < 0}
        />
      }
    >
      <Field label="從哪個月開始">
        <DateField value={yearMonth} onChange={setYearMonth} granularity="month" />
      </Field>

      <p className={`${text.muted} leading-relaxed`}>
        這筆金額會從 <span className="font-semibold text-[#4A3B7C]">{yearMonth}</span> 開始生效，之後每個月都沿用，直到你在更後面的月份再設一筆新的為止。
        填 0 代表從這個月起這個分類不編預算。
      </p>
    </Modal>
  );
}
