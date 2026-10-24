"use client";

import { IconAvatar } from "./icon-avatar";
import { unselectedOption } from "./theme";

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
 *  - 格子裡沒有刪除：分類要刪去「設定 › 收支分類」，帳戶類型要刪去「設定 › 帳戶類型」，
 *    刪除都集中在那兩頁（有使用中的檢查、批次選取），選擇器只負責選。 */
export function OptionGrid({
  options,
  value,
  onChange,
  onAddClick,
  addLabel = "新增",
  className = "",
}: {
  options: GridOption[];
  value: string;
  onChange: (id: string) => void;
  onAddClick?: () => void;
  addLabel?: string;
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
          <div key={option.id} className="flex flex-col items-center gap-1 py-0.5">
            <button
              type="button"
              onClick={() => onChange(option.id)}
              // 挑了一個之後其他格子淡掉（跟圖示選擇器同一組 class，見 theme.ts）——
              // 格子一多的時候，光靠選中那格的色環很難一眼看出挑到哪個。
              className={`flex w-full flex-col items-center gap-1 transition-opacity ${value && !active ? unselectedOption : ""}`}
            >
              <IconAvatar
                icon={option.icon}
                size="sm"
                className={`${option.colorClass ?? "bg-[#F3EFFC]"} ${active ? "ring-2 ring-[#6F5FD6] ring-offset-2" : ""}`}
              />
              <span className={`line-clamp-1 w-full text-center text-[11px] ${active ? "font-semibold text-[#6F5FD6]" : "font-medium text-[#4A3B7C]"}`}>
                {option.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
