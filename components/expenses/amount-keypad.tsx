"use client";

import { gradient } from "./theme";

// 找 expr 裡最後一個運算子之後的那一段（目前正在打的那個數字），判斷要不要擋重複的
// 小數點、要不要把開頭的孤零零「0」換掉，而不是直接疊成「05」。
function lastSegment(expr: string): string {
  let idx = -1;
  for (const op of ["+", "-", "×", "÷"]) {
    const i = expr.lastIndexOf(op);
    if (i > idx) idx = i;
  }
  return expr.slice(idx + 1);
}

/** 簡單的「依序算」計算機（1+2×3＝9，不是先乘除後加減的數學運算式）——跟參考圖那種
 *  記帳 app 內建小算盤的行為一致，夠用、也不用自己寫運算子優先級的 parser。新增交易
 *  跟新增轉帳都用這個算金額，所以獨立成共用元件，不要兩邊各自維護一份一樣的邏輯。 */
export function evaluateExpr(expr: string): number {
  const tokens = expr.match(/\d+\.?\d*|[+\-×÷]/g);
  if (!tokens || tokens.length === 0) return 0;
  let result = parseFloat(tokens[0]);
  if (!Number.isFinite(result)) result = 0;
  for (let i = 1; i < tokens.length - 1; i += 2) {
    const op = tokens[i];
    const next = parseFloat(tokens[i + 1]);
    if (!Number.isFinite(next)) break;
    if (op === "+") result += next;
    else if (op === "-") result -= next;
    else if (op === "×") result *= next;
    else if (op === "÷") result = next !== 0 ? result / next : result;
  }
  return result;
}

function KeyButton({
  label,
  onClick,
  disabled = false,
  tone = "default",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "op" | "eq";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid h-12 place-items-center rounded-2xl text-lg font-semibold transition-colors disabled:opacity-40 ${
        tone === "eq" ? "text-white" : tone === "op" ? "bg-[#F3EFFC] text-[#6F5FD6]" : "border border-[#ECE4FA] bg-white text-[#4A3B7C]"
      }`}
      style={tone === "eq" ? { background: gradient.primary } : undefined}
    >
      {label}
    </button>
  );
}

/** 金額輸入共用元件——NT$ 大字顯示＋4×4 內建小算盤（新增交易、新增轉帳都用這個）。
 *  是受控元件：expr 是目前打在螢幕上的原始字串（例如 "120+45"），呼叫端自己存狀態、
 *  用 evaluateExpr(expr) 算出實際金額，這裡只負責「怎麼編輯這個字串」。 */
export function AmountKeypad({
  expr,
  onExprChange,
  color = "#D1517E",
}: {
  expr: string;
  onExprChange: (expr: string) => void;
  /** NT$ 字樣的顏色——支出/轉出習慣用紅色，收入習慣用綠色，呼叫端自己決定。 */
  color?: string;
}) {
  function pressDigit(d: string) {
    const seg = lastSegment(expr);
    if (seg === "0") onExprChange(expr.slice(0, expr.length - seg.length) + d);
    else onExprChange(expr + d);
  }

  function pressDecimal() {
    const seg = lastSegment(expr);
    if (seg.includes(".")) return;
    onExprChange(seg === "" ? expr + "0." : expr + ".");
  }

  function pressOperator(op: string) {
    if (!expr) return;
    if (/[+\-×÷]$/.test(expr)) onExprChange(expr.slice(0, -1) + op);
    else onExprChange(expr + op);
  }

  function pressEquals() {
    if (!expr) return;
    const val = evaluateExpr(expr);
    if (Number.isFinite(val)) onExprChange(String(Math.round(val * 100) / 100));
  }

  function pressBackspace() {
    onExprChange(expr.slice(0, -1));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[#9C94C4]">金額</span>
        <button type="button" onClick={pressBackspace} aria-label="刪除一位數" className="text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
          ⌫
        </button>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold" style={{ color }}>
          NT$
        </span>
        <span className="truncate text-3xl font-bold tabular-nums text-[#4A3B7C]">{expr || "0"}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <KeyButton label="1" onClick={() => pressDigit("1")} />
        <KeyButton label="2" onClick={() => pressDigit("2")} />
        <KeyButton label="3" onClick={() => pressDigit("3")} />
        <KeyButton label="＋" onClick={() => pressOperator("+")} disabled={!expr} tone="op" />

        <KeyButton label="4" onClick={() => pressDigit("4")} />
        <KeyButton label="5" onClick={() => pressDigit("5")} />
        <KeyButton label="6" onClick={() => pressDigit("6")} />
        <KeyButton label="－" onClick={() => pressOperator("-")} disabled={!expr} tone="op" />

        <KeyButton label="7" onClick={() => pressDigit("7")} />
        <KeyButton label="8" onClick={() => pressDigit("8")} />
        <KeyButton label="9" onClick={() => pressDigit("9")} />
        <KeyButton label="×" onClick={() => pressOperator("×")} disabled={!expr} tone="op" />

        <KeyButton label="." onClick={pressDecimal} />
        <KeyButton label="0" onClick={() => pressDigit("0")} />
        <KeyButton label="＝" onClick={pressEquals} disabled={!expr} tone="eq" />
        <KeyButton label="÷" onClick={() => pressOperator("÷")} disabled={!expr} tone="op" />
      </div>
    </div>
  );
}
