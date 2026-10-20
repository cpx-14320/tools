"use client";

import { IconAvatar } from "./icon-avatar";

export interface GridOption {
  id: string;
  name: string;
  icon: string;
  /** IconAvatar 的底色 class（分類用 categoryColorClass[color]）；不給就用預設的淡紫底，
   *  給沒有顏色欄位的東西用（例如帳戶類型）。 */
  colorClass?: string;
}

/** 圖示格子選擇器——一列五欄、不畫外框，選中的那一格靠圖示外圈的強調色環表示。
 *
 *  新增消費紀錄的分類格子、新增帳戶的類型格子長得一樣、行為也一樣，本來是兩份各自
 *  手刻的 JSX（欄數、有沒有外框、「＋新增」放第一格還是最後一格都不一致），統一成
 *  這一個元件，兩邊的外觀和操作就不會再各走各的。
 *
 *  - `onAddClick` 有給才顯示第一格的「＋新增」。
 *  - `onDelete` 有給才在每一格右上角顯示小叉叉；刪除跟選取是兩顆並排的按鈕（按鈕裡
 *    不能再放按鈕），點叉叉不會連帶選到那一格。 */
export function OptionGrid({
  options,
  value,
  onChange,
  onAddClick,
  onDelete,
  addLabel = "新增",
  deleteLabelOf,
  className = "",
}: {
  options: GridOption[];
  value: string;
  onChange: (id: string) => void;
  onAddClick?: () => void;
  onDelete?: (option: GridOption) => void;
  addLabel?: string;
  /** 刪除鈕的無障礙說明，例如 `(o) => \`刪除「${o.name}」類型\``。 */
  deleteLabelOf?: (option: GridOption) => string;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-5 gap-x-1 gap-y-2.5 ${className}`}>
      {onAddClick && (
        <button type="button" onClick={onAddClick} className="flex flex-col items-center gap-1 py-0.5">
          <IconAvatar icon="＋" size="sm" className="bg-[#F3EFFC] text-[#6F5FD6]" />
          <span className="line-clamp-1 w-full text-center text-[11px] font-medium text-[#6F5FD6]">{addLabel}</span>
        </button>
      )}
      {options.map((option) => {
        const active = option.id === value;
        return (
          <div key={option.id} className="relative flex flex-col items-center gap-1 py-0.5">
            <button type="button" onClick={() => onChange(option.id)} className="flex w-full flex-col items-center gap-1">
              <IconAvatar
                icon={option.icon}
                size="sm"
                className={`${option.colorClass ?? "bg-[#F3EFFC]"} ${active ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
              />
              <span className={`line-clamp-1 w-full text-center text-[11px] ${active ? "font-semibold text-[#6F5FD6]" : "font-medium text-[#4A3B7C]"}`}>
                {option.name}
              </span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(option)}
                aria-label={deleteLabelOf?.(option) ?? `刪除「${option.name}」`}
                className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full border border-[#ECE4FA] bg-white text-[#D1517E] shadow-sm"
              >
                <span aria-hidden className="text-[10px] leading-none">
                  ✕
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
