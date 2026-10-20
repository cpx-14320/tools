"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { PillButton } from "./button";
import { DatePickerModal } from "./date-picker-modal";
import { text } from "./theme";
import { assetCompareLabel, type AssetCompareMode, type AssetCompareSetting } from "@/lib/expenses/asset-compare";

const OPTIONS: { value: AssetCompareMode; label: string; hint: string }[] = [
  { value: "lastMonthEnd", label: "上月底", hint: "看這個月資產增加或減少了多少" },
  { value: "lastYear", label: "去年同日", hint: "跟一年前的同一天比" },
  { value: "custom", label: "指定日期", hint: "挑任何一天當基準" },
  { value: "none", label: "不比較", hint: "隱藏所有漲跌幅" },
];

/** 資產頁的比較基準選單——跟消費頁的 ComparePicker 長得像，但選項不同：資產比的是
 *  「現在 vs 某一天」的餘額差，不是「這一段 vs 另一段」的加總，所以沒有「上一期」
 *  這種概念，改成「上月底／去年同日／指定日期」三種時間點。 */
export function AssetComparePicker({
  setting,
  onChange,
  className = "",
}: {
  setting: AssetCompareSetting;
  onChange: (setting: AssetCompareSetting) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <>
      <PillButton onClick={() => setOpen(true)} className={className}>
        <span className="max-w-[112px] truncate">{assetCompareLabel(setting)}</span>
        <span aria-hidden>▾</span>
      </PillButton>

      <Modal open={open} onClose={() => setOpen(false)} title="比較基準">
        <p className={`${text.muted} leading-relaxed`}>淨資產／資產／負債旁邊的漲跌幅，以及資產配置每一類的增減，都是拿現在的餘額跟下面選的這一天相比。</p>

        <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
          {OPTIONS.map((opt) => {
            const active = setting.mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (opt.value === "custom") {
                    setDatePickerOpen(true);
                    return;
                  }
                  onChange({ ...setting, mode: opt.value });
                  setOpen(false);
                }}
                className={`px-4 py-3 text-left ${active ? "bg-[#F9F7FE]" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${active ? "text-[#6F5FD6]" : "text-[#4A3B7C]"}`}>
                    {opt.label}
                    {opt.value === "custom" && setting.customDate && active ? `（${setting.customDate}）` : ""}
                  </span>
                  {active && <span className="text-xs font-semibold text-[#6F5FD6]">使用中</span>}
                </div>
                <p className={`mt-0.5 ${text.faint}`}>{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </Modal>

      <DatePickerModal
        open={datePickerOpen}
        initial={setting.customDate || new Date().toISOString().slice(0, 10)}
        onClose={() => setDatePickerOpen(false)}
        onSave={(value) => {
          onChange({ mode: "custom", customDate: value });
          setDatePickerOpen(false);
          setOpen(false);
        }}
      />
    </>
  );
}
