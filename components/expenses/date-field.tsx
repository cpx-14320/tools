"use client";

import { useState } from "react";
import { DatePickerModal, type DateGranularity } from "./date-picker-modal";
import { SelectField } from "./select-field";

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
      {/* 跟帳戶、金額那幾欄共用同一顆 SelectField，樣式統一在那裡維護。 */}
      <SelectField value={label || undefined} placeholder={placeholder} disabled={disabled} onClick={() => setOpen(true)} className={className} />
      {/* 只在打開的時候才掛上去：DatePickerModal 的年／月／日是 useState 初始值，元件
          一直掛著的話只會在第一次讀 initial，之後欄位的值變了（或換成編輯另一筆資料）
          再打開看到的還是上一次留下來的年月日。 */}
      {open && (
        <DatePickerModal
          open
          granularity={granularity}
          initial={value}
          onClose={() => setOpen(false)}
          onSave={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
