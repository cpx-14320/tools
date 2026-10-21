"use client";

import { IconAvatar } from "./icon-avatar";
import { Field } from "./modal";
import { text } from "./theme";
import { ACCOUNT_ICON_OPTIONS, EXPENSE_ICON_OPTIONS, INCOME_ICON_OPTIONS, ICON_OTHER, type IconOption } from "@/lib/expenses/presets";
import { categoryFillClass, type CategoryColor, type CategoryKind } from "@/lib/expenses/categories";

/** 圖示選擇器——從已經有圖檔的那幾張裡挑，不是自己輸入表情符號。
 *
 *  圖是一張張畫出來放進 public/expenses 的，使用者沒辦法「自己輸入一個路徑」（打錯就是
 *  破圖），所以這裡是封閉的清單；還沒有專屬圖的分類就選最後那張「其他」頂著，之後補了
 *  圖再回來改。清單隨著 lib/expenses/presets.ts 裡的圖變多而加長，這個元件不用改。 */
function IconPicker({ options, value, onChange }: { options: IconOption[]; value: string; onChange: (icon: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={text.label}>圖示</span>
      {/* 只排圖、不寫名稱——這裡挑的是「長什麼樣子」，不是在選一個已經定義好的分類，
          圖下面掛一行名稱反而會讓人以為選了圖就等於選了那個分類。名稱留在 aria-label
          給讀螢幕軟體用。 */}
      <div className="grid grid-cols-6 gap-2">
        {options.map((option) => (
          <button
            key={option.path}
            type="button"
            onClick={() => onChange(option.path)}
            aria-label={`圖示 ${option.label}`}
            className="flex items-center justify-center"
          >
            <IconAvatar
              icon={option.path}
              size="sm"
              className={`bg-[#F3EFFC] ${value === option.path ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
            />
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

/** 存錢目標用的圖示選擇器——目標沒有自己的一套圖，先共用支出分類那組（之後補了專屬的
 *  目標圖示，改這裡一行就好）。 */
export function GoalIconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return <IconPicker options={EXPENSE_ICON_OPTIONS} value={value} onChange={onChange} />;
}

/** 分類顏色選擇器——六個色票圓點，選中的那顆外圈加色環。新增分類（批次）跟編輯分類
 *  兩個彈窗本來各自手刻一份一模一樣的，收斂成這一個。 */
export function CategoryColorPicker({ value, onChange }: { value: CategoryColor; onChange: (color: CategoryColor) => void }) {
  return (
    <Field label="顏色">
      <div className="flex gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`顏色 ${c}`}
            onClick={() => onChange(c)}
            className={`size-8 rounded-full ${categoryFillClass[c]} ${value === c ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
          />
        ))}
      </div>
    </Field>
  );
}

export const CATEGORY_COLORS: CategoryColor[] = ["a", "b", "c", "d", "e", "f"];

/** 新增分類／帳戶類型時的預設圖示——還沒選之前就先放共用的「其他」，不會有空白圖示。 */
export const DEFAULT_PICKER_ICON = ICON_OTHER;
