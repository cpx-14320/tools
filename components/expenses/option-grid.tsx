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

/** 第一格的特殊項目——新增收支紀錄是「＋新增」，明細篩選是「全部」。它不是 options
 *  裡的一員（不能被選起來、也沒有 id），所以單獨傳。 */
interface LeadingSlot {
  icon: string;
  name: string;
  /** 自己要不要顯示成選中。「＋新增」永遠是 false，「全部」在沒挑任何分類時是 true。 */
  active?: boolean;
  onClick: () => void;
}

/** 圖示格子選擇器——一列五欄、不畫外框。
 *
 *  **選中的表示方式是「亮的那一個」，沒選中的淡掉**（見 theme.ts 的 unselectedOption），
 *  不是加外框或色環：圖本身就是去背的彩色插圖，再套一圈環等於在圖外面多畫一個不屬於
 *  它的形狀，一整排看起來很吵。
 *
 *  新增收支紀錄的分類格子、新增帳戶的類型格子、明細篩選的分類格子都走這一個元件，
 *  本來是三份各自手刻的 JSX（欄數、有沒有外框、第一格放什麼都不一致）。
 *
 *  單選傳 value/onChange，複選傳 multiple + values/onToggle。
 *
 *  格子裡沒有刪除：分類要刪去「設定 › 收支分類」，帳戶類型要刪去「設定 › 帳戶類型」，
 *  刪除都集中在那兩頁（有使用中的檢查、批次選取），選擇器只負責選。 */
export function OptionGrid({
  options,
  value,
  onChange,
  multiple = false,
  values,
  onToggle,
  onAddClick,
  addLabel = "新增",
  leadingSlot,
  className = "",
}: {
  options: GridOption[];
  /** 單選：目前選中的 id。 */
  value?: string;
  onChange?: (id: string) => void;
  /** 複選模式。 */
  multiple?: boolean;
  values?: string[];
  onToggle?: (id: string) => void;
  /** 第一格放「＋新增」。跟 leadingSlot 二選一。 */
  onAddClick?: () => void;
  addLabel?: string;
  /** 第一格放別的東西（明細篩選的「全部」）。 */
  leadingSlot?: LeadingSlot;
  className?: string;
}) {
  const isActive = (id: string) => (multiple ? (values ?? []).includes(id) : id === value);
  const lead: LeadingSlot | undefined =
    leadingSlot ?? (onAddClick ? { icon: "＋", name: addLabel, active: false, onClick: onAddClick } : undefined);

  return (
    <div className={`grid grid-cols-5 gap-x-1 gap-y-2.5 ${className}`}>
      {lead && (
        <div className="flex flex-col items-center gap-1 py-0.5">
          <button
            type="button"
            onClick={lead.onClick}
            className={`flex w-full flex-col items-center gap-1 transition-opacity ${lead.active ? "" : unselectedOption}`}
          >
            <IconAvatar icon={lead.icon} className="bg-[#F3EFFC] text-[#6F5FD6]" />
            <span className="line-clamp-1 w-full text-center text-[11px] font-medium text-[#6F5FD6]">{lead.name}</span>
          </button>
        </div>
      )}
      {options.map((option) => {
        const active = isActive(option.id);
        return (
          <div key={option.id} className="flex flex-col items-center gap-1 py-0.5">
            <button
              type="button"
              onClick={() => (multiple ? onToggle?.(option.id) : onChange?.(option.id))}
              // 沒選到的一律淡掉，包含「還沒選任何一個」的時候——亮起來的那一格就是答案，
              // 不用再另外畫一圈色環去指它（跟圖示選擇器同一組 class，見 theme.ts）。
              className={`flex w-full flex-col items-center gap-1 transition-opacity ${active ? "" : unselectedOption}`}
            >
              <IconAvatar icon={option.icon} className={option.colorClass ?? "bg-[#F3EFFC]"} />
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
