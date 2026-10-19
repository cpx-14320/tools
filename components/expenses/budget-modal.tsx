"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal } from "./modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { text } from "./theme";
import { isLegacyRule, rulesForCategory, type BudgetRuleDTO } from "@/lib/expenses/budgets";
import type { CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency } from "@/lib/format";

/** 設定某個分類「從某個月起」的預算。下方會列出這個分類目前所有的變更紀錄（哪個月開始
 *  改成多少），可以個別刪掉——刪掉之後那一段就回去沿用更早的那一筆。 */
export function BudgetModal({
  open,
  category,
  yearMonth,
  rules,
  currentAmount,
  onClose,
  onSave,
  onDeleteRule,
}: {
  open: boolean;
  category: CategoryDTO | null;
  /** 這次設定要從哪個月開始生效。 */
  yearMonth: string;
  rules: BudgetRuleDTO[];
  /** 這個分類在 yearMonth 當下已經生效的金額（沿用更早的規則算出來的），當輸入框預設值。 */
  currentAmount: number;
  onClose: () => void;
  onSave: (amount: number) => void;
  onDeleteRule: (ruleId: string) => void;
}) {
  const [expr, setExpr] = useState(currentAmount > 0 ? String(currentAmount) : "");
  const amount = evaluateExpr(expr);
  const history = category ? rulesForCategory(rules, category.id) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? `${category.name} 的預算` : "設定預算"}
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button disabled={!Number.isFinite(amount) || amount < 0} onClick={() => onSave(amount)}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <p className={`${text.muted} leading-relaxed`}>
        這筆金額會從 <span className="font-semibold text-[#4A3B7C]">{yearMonth}</span> 開始生效，之後每個月都沿用，直到你在更後面的月份再設一筆新的為止。
        填 0 代表從這個月起這個分類不編預算。
      </p>

      <AmountKeypad expr={expr} onExprChange={setExpr} color="#6F5FD6" />

      {history.length > 0 && (
        <div>
          <p className={`mb-2 ${text.label}`}>變更紀錄</p>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
            {history.map((rule) => {
              // 舊版存在分類身上的預算會補成一筆沒有生效月份的虛擬規則，資料庫裡沒有這一筆
              // 可以刪，所以只顯示、不給刪除鈕；設一筆新的就會蓋過它。
              const legacy = isLegacyRule(rule);
              return (
                <div key={rule.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`min-w-0 flex-1 ${text.body}`}>{legacy ? "改版前的設定" : `${rule.effectiveFrom} 起`}</span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-[#4A3B7C]">
                    {rule.amount > 0 ? formatCurrency(rule.amount) : "不編預算"}
                  </span>
                  {legacy ? (
                    <span className={`shrink-0 text-xs ${text.faint}`}>沿用中</span>
                  ) : (
                    <button type="button" onClick={() => onDeleteRule(rule.id)} className="shrink-0 text-xs font-medium text-[#D1517E]">
                      刪除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
