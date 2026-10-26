"use client";

import { Field } from "./modal";
import { SelectField } from "./select-field";
import { gradient } from "./theme";
import { formatCurrency } from "@/lib/format";

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
/** NT$ 字樣的顏色。所有彈窗一律用這個紅色（＝新增消費紀錄那個），不跟著收入/支出或
 *  轉帳/預算換色——同一個鍵盤在不同彈窗變成三種顏色，看起來像三個不同的元件。 */
const AMOUNT_COLOR = "#D1517E";

export function AmountKeypad({
  expr,
  onExprChange,
  label,
  prefix = "NT$",
}: {
  expr: string;
  onExprChange: (expr: string) => void;
  /** 數字上方的小標，只有在「這個鍵盤現在不是在編一般金額」時才需要（例如改某一筆
   *  明細項目的金額）；平常不傳，因為旁邊就是一個大大的 NT$ 金額，再寫一次「金額」
   *  是多餘的。 */
  label?: string;
  /** 數字前面的單位。預設「NT$」因為絕大多數用途都是金額；輸入數量這種非金額的場合
   *  傳空字串，不然會變成「NT$ 3」份。 */
  prefix?: string;
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
      {label && <p className="mb-1 truncate text-xs font-medium text-[#9C94C4]">{label}</p>}
      {/* 刪除鍵跟金額同一列（靠右）——上面不再另外放一行「金額」小標，那行字旁邊就是
          這個大大的 NT$ 數字，再標一次是多餘的。 */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {prefix && (
            <span className="text-xl font-bold" style={{ color: AMOUNT_COLOR }}>
              {prefix}
            </span>
          )}
          <span className="truncate text-3xl font-bold tabular-nums text-[#4A3B7C]">{expr || "0"}</span>
        </span>
        <button type="button" onClick={pressBackspace} aria-label="刪除一位數" className="shrink-0 text-lg text-[#9C94C4] hover:text-[#6F5FD6]">
          ⌫
        </button>
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

/** 金額欄位——長得像輸入框，但點了不會跳出手機原生鍵盤，只是把彈窗下方那個固定小鍵盤
 *  的編輯對象切到這一欄（選中時邊框會變色）。
 *
 *  彈窗裡只要出現金額，一律用這組「欄位顯示＋下方固定鍵盤」的搭配，不要有的用這個、
 *  有的用原生 `<input type="number">`——原生鍵盤跳出來會把彈窗推上去、關掉又彈回來，
 *  跟記帳本其他地方的輸入手感完全不同。 */
export function AmountField({
  label,
  value,
  active,
  onFocus,
  placeholder = "點這裡用下方鍵盤輸入",
}: {
  label: string;
  value: number;
  /** 下方鍵盤目前是不是在編這一欄。 */
  active: boolean;
  onFocus: () => void;
  placeholder?: string;
}) {
  // 跟日期、帳戶那幾欄共用同一顆 SelectField，樣式才會完全一致（含 placeholder 的顏色、
  // 還有「placeholder 是空字串時不要塌成 0 高」這件事）。
  return (
    <Field label={label}>
      <SelectField value={value ? formatCurrency(value) : undefined} placeholder={placeholder} active={active} onClick={onFocus} className="tabular-nums" />
    </Field>
  );
}
