"use client";

import { breakdownNet, type BreakdownItem } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

/** 交易列右邊的展開收合箭頭——只有真的有明細（薪資的本薪／勞健保那種）的那幾筆才會
 *  出現，預設收起來。放在交易列的「編輯」按鈕外面，不是包在裡面：button 不能巢狀，
 *  不然點展開會連帶觸發開啟編輯彈窗。 */
export function BreakdownToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? "收合明細" : "展開明細"}
      aria-expanded={expanded}
      className="grid size-7 shrink-0 place-items-center rounded-full text-[#9C94C4] transition-colors hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
    >
      <span aria-hidden className={`text-[10px] transition-transform ${expanded ? "rotate-180" : ""}`}>
        ▼
      </span>
    </button>
  );
}

/** 展開後的明細清單——加項綠色、扣項紅色，最後補一列淨額（＝交易本身的金額），
 *  讓使用者一眼對得起來「這些項目加減完就是上面那個數字」。 */
export function TransactionBreakdown({ items }: { items: BreakdownItem[] }) {
  return (
    <div className="border-t border-[#F2EEFA] bg-[#F9F7FE] px-3 py-2.5">
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-[#4A3B7C]">{item.label}</span>
            <span className={`shrink-0 tabular-nums font-medium ${item.kind === "扣項" ? "text-[#D1517E]" : "text-[#2FAE82]"}`}>
              {item.kind === "扣項" ? "－" : "＋"}
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
        <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-[#ECE4FA] pt-1.5 text-xs">
          <span className="font-medium text-[#9C94C4]">淨額</span>
          <span className="shrink-0 font-semibold tabular-nums text-[#4A3B7C]">{formatCurrency(breakdownNet(items))}</span>
        </div>
      </div>
    </div>
  );
}
