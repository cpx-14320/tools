"use client";

/** 養成頁彈窗（PetModal）裡面共用的那幾種零件。
 *
 *  **為什麼不直接用記帳本那套**：養成頁是一整張插畫遊戲畫面，彈窗的框是畫出來的
 *  （見 pet-modal.tsx）。把記帳本的白底卡片、淡紫膠囊原封不動放進那個框裡，看起來就像
 *  在遊戲畫面上開了一張表單——商店、背包以前就是那樣（整個白色 Modal 蓋上來），跟隔壁的
 *  簽到、說明完全是兩個 App。這裡把頁籤、格子、文字色收成一組，照簽到彈窗那套色票走。
 *
 *  色票（跟 pet-signin-modal.tsx 的內容一致）：
 *    #5B3B8C  標題／格子名稱
 *    #8A6BBE  次要說明
 *    #9C7FC0  更淡的註腳
 *    #EFC14F / #FDF2DA  金色強調（簽到的大獎那一條）
 *    #9B7BD6 / #F1E7FD  選取、使用中 */

/** 彈窗裡的分類頁籤。做成一整條淡紫色的軌道＋選中那格白底，跟記帳本的 SegmentedControl
 *  同一種操作，但配色跟著插畫走。 */
export function PetTabs<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 rounded-full bg-[#EFE4FB] p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors ${
            o.value === value ? "bg-white text-[#5B3B8C] shadow-[0_2px_6px_-2px_rgba(91,59,140,0.45)]" : "text-[#9C7FC0]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 格狀清單裡的一格（商店的商品、背包的服裝／背景）。
 *  selected ＝ 選取中或使用中；locked ＝ 等級不夠，點不動但仍然看得到。 */
export function petTileClass({ selected = false, locked = false }: { selected?: boolean; locked?: boolean } = {}): string {
  return `relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2 text-center transition-colors ${
    selected ? "border-[#9B7BD6] bg-[#F1E7FD]" : "border-[#E3D4F5] bg-white/85"
  } ${locked ? "opacity-55" : ""}`;
}

/** 格子裡的名稱。 */
export const petTileLabelClass = "line-clamp-1 w-full text-[11px] font-bold text-[#5B3B8C]";

/** 格子裡的價格／狀態那一行。 */
export const petTileNoteClass = "text-[10px] font-medium text-[#8A6BBE]";

/** 縮圖外框（背景、服裝那種整張圖的縮圖）。 */
export const petThumbClass = "aspect-square w-full rounded-xl border border-[#E3D4F5]";
