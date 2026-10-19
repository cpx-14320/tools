"use client";

import { IconAvatar } from "./icon-avatar";
import { text } from "./theme";
import { ACCOUNT_ICON_OPTIONS, EXPENSE_ICON_OPTIONS, INCOME_ICON_OPTIONS, ICON_OTHER, type IconOption } from "@/lib/expenses/presets";
import type { CategoryKind } from "@/lib/expenses/categories";

/** 圖示選擇器——從已經有圖檔的那幾張裡挑，不是自己輸入表情符號。
 *
 *  圖是一張張畫出來放進 public/expenses 的，使用者沒辦法「自己輸入一個路徑」（打錯就是
 *  破圖），所以這裡是封閉的清單；還沒有專屬圖的分類就選最後那張「其他」頂著，之後補了
 *  圖再回來改。清單隨著 lib/expenses/presets.ts 裡的圖變多而加長，這個元件不用改。 */
function IconPicker({ options, value, onChange }: { options: IconOption[]; value: string; onChange: (icon: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={text.label}>圖示</span>
      <div className="grid grid-cols-5 gap-2">
        {options.map((option) => (
          <button
            key={option.path}
            type="button"
            onClick={() => onChange(option.path)}
            aria-label={`圖示 ${option.label}`}
            className="flex flex-col items-center gap-1"
          >
            <IconAvatar
              icon={option.path}
              size="sm"
              className={`bg-[#F3EFFC] ${value === option.path ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
            />
            <span className={`line-clamp-1 w-full text-center text-[11px] ${value === option.path ? "font-semibold text-[#6F5FD6]" : text.muted}`}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 分類用的圖示選擇器——支出跟收入各有自己的一組圖。 */
export function CategoryIconPicker({ kind, value, onChange }: { kind: CategoryKind; value: string; onChange: (icon: string) => void }) {
  return <IconPicker options={kind === "收入" ? INCOME_ICON_OPTIONS : EXPENSE_ICON_OPTIONS} value={value} onChange={onChange} />;
}

/** 帳戶類型用的圖示選擇器。 */
export function AccountIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return <IconPicker options={ACCOUNT_ICON_OPTIONS} value={value} onChange={onChange} />;
}

/** 新增分類／帳戶類型時的預設圖示——還沒選之前就先放共用的「其他」，不會有空白圖示。 */
export const DEFAULT_PICKER_ICON = ICON_OTHER;
