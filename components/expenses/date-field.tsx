"use client";

import { useState } from "react";
import { DatePickerModal, type DateGranularity } from "./date-picker-modal";
import { fieldInputClass } from "./modal";

function formatLabel(value: string, granularity: DateGranularity): string {
  const [y, m, d] = value.split("-");
  if (!y || !m) return "";
  return granularity === "month" ? `${y} 年 ${Number(m)} 月` : `${y}/${m}/${d ?? ""}`;
}

/** 取代原生 `<input type="date">`／`<input type="month">` 的觸發元件——長得像一般輸入框，
 *  點下去開 DatePickerModal 選，不是喚出瀏覽器自己的原生日期選擇 UI。 */
export function DateField({
  value,
  onChange,
  granularity = "day",
  placeholder = "選擇日期",
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  granularity?: DateGranularity;
  placeholder?: string;
  disabled?: boolean;
  /** 外層要控制寬度時用（例如跟「今天／昨天」快捷鍵排在同一列要 flex-1）。 */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? formatLabel(value, granularity) : "";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${fieldInputClass} text-left disabled:opacity-60 ${className}`}
      >
        <span className={label ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}>{label || placeholder}</span>
      </button>
      <DatePickerModal
        open={open}
        granularity={granularity}
        initial={value}
        onClose={() => setOpen(false)}
        onSave={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </>
  );
}
