"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { IconAvatar } from "./icon-avatar";
import { text } from "./theme";
import { categoryColorClass, type CategoryDTO } from "@/lib/expenses/categories";
import { formatYearMonth } from "@/lib/format";

export interface BudgetBatchItem {
  categoryId: string;
  amount: number;
}

/** 批次設定預算——勾好幾個分類，在同一個彈窗裡一次把它們的生效月份跟金額都填完。
 *
 *  **為什麼月份共用、金額一個一個填**：生效月份是「這次要從哪個月開始改」，一批一起改
 *  本來就是同一個月份；金額則每個分類天差地遠（房租 15000、飲料 1200），共用一個數字
 *  的批次設定多數時候用不到——真的要全部設成同一個數字時，把每一列填成一樣的也只是
 *  多打幾下。
 *
 *  版面照「批次新增分類」那一套（一則一列、在同一個彈窗裡填完再一起送出），差別是這裡
 *  的列是「已經勾好的分類」，不能增減。
 *
 *  金額用一般的數字輸入框而不是記帳本那個自製鍵盤：鍵盤一次只能對焦一個欄位，這裡同時
 *  有好幾列要填，每填一列就要切換焦點、鍵盤還會蓋住下面那幾列。 */
export function BudgetBatchModal({
  open,
  categories,
  defaultYearMonth,
  /** 每個分類目前生效中的金額，用來當輸入框的預設值。 */
  currentAmounts,
  onClose,
  onSave,
}: {
  open: boolean;
  categories: CategoryDTO[];
  defaultYearMonth: string;
  currentAmounts: Record<string, number | undefined>;
  onClose: () => void;
  onSave: (yearMonth: string, items: BudgetBatchItem[]) => void | Promise<unknown>;
}) {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [fillAll, setFillAll] = useState("");
  // 金額一律用字串存：輸入過程中會有空字串、只打了一個「1」這種中間狀態，存成數字的話
  // 清空欄位會變成 0，使用者還沒填完就先被填上一個數字。
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, currentAmounts[c.id] ? String(currentAmounts[c.id]) : ""])),
  );

  const items = categories
    .map((c) => ({ categoryId: c.id, amount: Number(amounts[c.id]) }))
    // 空著的那幾列＝這次不改它（不是改成 0，那是「不編預算」的意思）。
    .filter((item) => amounts[item.categoryId]?.trim() !== "" && Number.isFinite(item.amount) && item.amount >= 0)
    // 金額跟現在生效中的一樣就不寫：寫下去只是在那個分類的歷程多一列「2026/11 起 NT$500」，
    // 跟上一列一模一樣的數字。每一列本來就預先帶好目前的金額，只改其中一兩個分類是常態。
    .filter((item) => item.amount !== currentAmounts[item.categoryId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`批次設定預算（${categories.length} 個分類）`}
      footer={
        <ModalFooter
          onClose={onClose}
          // return 不能省：onSave 是非同步的，把 Promise 交回 ModalFooter 才會在送出
          // 期間鎖住儲存鍵。
          onConfirm={() => onSave(yearMonth, items)}
          confirmDisabled={items.length === 0}
          disabledHint={items.length === 0 ? "改一下金額才有東西可以存" : undefined}
        />
      }
    >
      <Field label="從哪個月開始">
        <DateField value={yearMonth} onChange={setYearMonth} granularity="month" />
      </Field>

      <p className={`${text.muted} leading-relaxed`}>
        從 <span className="font-semibold text-[#4A3B7C]">{formatYearMonth(yearMonth)}</span> 起每個月都用這些金額，直到設下一筆新的為止。
        填 0 表示不編預算，空著的分類這次不會被改到。
      </p>

      {/* 「全部設成同一個金額」本來規劃成另一顆批次動作、另一個彈窗，但它跟這裡只差在
          「每一列填不填一樣的數字」——做成這一列之後，使用者可以先一鍵填滿，再單獨改
          其中一兩個分類，不用為了一個例外退出去走另一條路。 */}
      {categories.length > 1 && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={fillAll}
            onChange={(e) => setFillAll(e.target.value)}
            placeholder="全部設成同一個金額"
            className={`${fieldInputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            disabled={fillAll.trim() === ""}
            onClick={() => setAmounts(Object.fromEntries(categories.map((c) => [c.id, fillAll.trim()])))}
            className="shrink-0 rounded-full bg-[#F3EFFC] px-3.5 py-2 text-xs font-medium text-[#6F5FD6] disabled:opacity-40"
          >
            一次填入
          </button>
        </div>
      )}

      <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
        {categories.map((c) => (
          <label key={c.id} className="flex items-center gap-3 px-4 py-3">
            <IconAvatar icon={c.icon} className={categoryColorClass[c.color]} />
            <span className={`min-w-0 flex-1 truncate ${text.body}`}>{c.name}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amounts[c.id] ?? ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder={currentAmounts[c.id] !== undefined ? String(currentAmounts[c.id]) : "未設定"}
              // `w-28!` 的驚嘆號不能拿掉：fieldInputClass 裡有 w-full，兩個寬度同時存在時
              // 誰贏是看產出的 CSS 順序而不是寫在後面——沒加的話輸入框會撐滿整列，把左邊的
              // 分類名稱擠成 0 寬度（看起來像名稱沒渲染出來）。
              className={`${fieldInputClass} w-28! shrink-0 text-right tabular-nums`}
            />
          </label>
        ))}
      </div>
    </Modal>
  );
}
