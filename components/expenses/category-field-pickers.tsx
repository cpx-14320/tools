"use client";

import { Field, fieldInputClass } from "./modal";
import { text } from "./theme";
import { CATEGORY_NAME_PRESETS, CATEGORY_ICON_OPTIONS } from "./category-presets";

/** 名稱欄位下方那排可以直接點的常用分類名稱——點了就把名稱填進去，照樣可以自己改成
 *  別的。新增分類彈窗跟批次新增彈窗共用。 */
export function CategoryNamePresets({ value, onPick }: { value: string; onPick: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_NAME_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onPick(preset)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            value.trim() === preset ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#9C94C4]"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}

/** 圖示格子選擇器——常用表情符號排成格子直接點，最後一格是自行輸入（格子裡沒有想要的
 *  圖示時，照樣可以貼上任何一個表情符號）。 */
export function CategoryIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={text.label}>圖示</span>
      <div className="grid grid-cols-8 gap-1.5">
        {CATEGORY_ICON_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-label={`圖示 ${option}`}
            className={`grid aspect-square place-items-center rounded-xl text-lg transition-colors ${
              value === option ? "bg-[#6F5FD6]" : "bg-[#F3EFFC] hover:bg-[#EFEAFC]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <Field label="或自行輸入一個表情符號">
        <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />
      </Field>
    </div>
  );
}
