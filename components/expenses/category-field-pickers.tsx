"use client";

import { InlineIcon } from "./icon-avatar";
import { Field } from "./modal";
import { text, unselectedOption } from "./theme";
import { ACCOUNT_ICON_OPTIONS, EXPENSE_ICON_OPTIONS, INCOME_ICON_OPTIONS, ICON_OTHER, type IconOption } from "@/lib/expenses/presets";
import { categoryFillClass, type CategoryColor, type CategoryKind } from "@/lib/expenses/categories";

/** 圖示選擇器——從已經有圖檔的那幾張裡挑，不是自己輸入表情符號。
 *
 *  圖是一張張畫出來放進 public/expenses 的，使用者沒辦法「自己輸入一個路徑」（打錯就是
 *  破圖），所以這裡是封閉的清單；還沒有專屬圖的分類就選最後那張「其他」頂著，之後補了
 *  圖再回來改。清單隨著 lib/expenses/presets.ts 裡的圖變多而加長，這個元件不用改。
 *
 *  呈現方式比照搭乘車的常用行程彈窗（components/transit/frequent-trip-modal.tsx）：圖直接
 *  放著，不套底色方塊、不加選取色環，選中的是「亮的那一張」、其他半透明。圖本身就是
 *  去背的彩色插圖，再墊一層淡紫底只是讓每張圖都被一個方塊框住，反而看不出挑的是哪張。
 *
 *  記帳本所有會挑圖示的彈窗（新增/編輯分類、批次新增分類、帳戶類型、存錢目標）都是走
 *  這一個元件，所以樣式只要改這裡一處。 */
function IconPicker({ options, value, onChange }: { options: IconOption[]; value: string; onChange: (icon: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={text.label}>圖示</span>
      {/* 只排圖、不寫名稱——這裡挑的是「長什麼樣子」，不是在選一個已經定義好的分類，
          圖下面掛一行名稱反而會讓人以為選了圖就等於選了那個分類。名稱留在 aria-label
          給讀螢幕軟體用。 */}
      {/* 固定六欄等寬的格狀排列，不是 flex-wrap：flex-wrap 是「排得下就塞」，一行塞幾張
          取決於彈窗寬度，上下兩行的圖對不齊，最後一行還會靠左擠成一團。六欄則是每一欄
          寬度相同、每一列都對齊，整塊看起來是一個規矩的圖庫。 */}
      <div className="grid grid-cols-6 gap-2">
        {options.map((option) => (
          <button
            key={option.path}
            type="button"
            onClick={() => onChange(option.path)}
            aria-label={`圖示 ${option.label}`}
            aria-pressed={value === option.path}
            className={`flex justify-center transition-opacity ${value === option.path ? "" : unselectedOption}`}
          >
            {/* 要 block：InlineIcon 是 <span>，行內元素吃不到寬高，不加的話整排會是空的。
                w-full + aspect-square：圖跟著欄寬縮放，六欄在窄螢幕上才不會擠爆。 */}
            <InlineIcon icon={option.path} className="block aspect-square w-full max-w-10" />
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
