"use client";

import type { ReactNode } from "react";
import { fieldInputClass } from "./modal";

/** 長得像輸入框、但其實是一顆按鈕的欄位——點了會開選擇彈窗（帳戶、日期）或把下方的
 *  小鍵盤切到這一欄（金額），而不是直接打字。
 *
 *  **為什麼不用 placeholder**：HTML 的 `placeholder` 只有 `<input>` 跟 `<textarea>` 有，
 *  `<button>` 沒有這個屬性。這幾欄不能用真的 input——按了要跳彈窗，真的 input 在手機上
 *  會同時叫出系統鍵盤，兩個東西搶同一塊畫面。所以「還沒選」的提示只能自己畫成一段
 *  淡色文字，顏色（#B3ABD4）跟真 input 的 `placeholder:text-[#B3ABD4]` 對齊，看起來
 *  才是同一種欄位。
 *
 *  本來帳戶選擇（新增交易、分類的預設帳戶、轉帳的轉出/轉入）各自手刻一份一模一樣的
 *  button + span，收斂成這一個；DateField、AmountField 因為還要多管日期格式與鍵盤焦點，
 *  各自保留自己的實作，但套用同一組樣式。 */
export function SelectField({
  value,
  placeholder,
  active = false,
  disabled = false,
  onClick,
  className = "",
  "aria-label": ariaLabel,
}: {
  /** 已經選好的內容；沒有值（undefined／空字串）就顯示 placeholder。 */
  value?: ReactNode;
  placeholder: string;
  /** 下方小鍵盤正在編這一欄時反白，讓使用者知道現在打的數字會進哪裡。 */
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${fieldInputClass} text-left disabled:opacity-60 ${active ? "border-[#6F5FD6] bg-[#F9F7FE]" : ""} ${className}`}
    >
      {/* block min-h-5：空字串的 placeholder（例如目標金額那一欄刻意不給提示文字）會讓
          行內元素高度變成 0，整顆按鈕比旁邊的輸入框矮一截。固定一行的高度就不會。 */}
      <span className={`block min-h-5 truncate ${hasValue ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}`}>{hasValue ? value : placeholder}</span>
    </button>
  );
}
