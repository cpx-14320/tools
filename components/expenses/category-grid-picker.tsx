"use client";

import { IconAvatar } from "./icon-avatar";
import {
  topLevelCategories,
  subCategoriesOf,
  categoryColorClass,
  topLevelCategoryId,
  type CategoryDTO,
  type CategoryKind,
} from "@/lib/expenses/categories";

/** 分類格子選擇器——取代原生 `<select>`：頂層分類排成格子，選到的如果有子分類會在下面
 *  展開一排子分類圓角選項可以再選更細的。新增交易彈窗、固定收支彈窗都共用這一個，
 *  不要兩邊各刻一份幾乎一樣的格子。`onAddClick` 不給的話就不顯示「＋新增」那一格
 *  （目前兩邊呼叫端都有給，但保留彈性給之後可能不需要就地新增分類的情境）。 */
export function CategoryGridPicker({
  categories,
  kind,
  value,
  onChange,
  onAddClick,
  maxHeightClass = "max-h-[260px]",
}: {
  categories: CategoryDTO[];
  kind: CategoryKind;
  value: string;
  onChange: (id: string) => void;
  onAddClick?: () => void;
  maxHeightClass?: string;
}) {
  const topCategories = topLevelCategories(categories, kind);
  const activeParentId = value ? topLevelCategoryId(categories, value) : "";
  const subcategories = activeParentId ? subCategoriesOf(categories, activeParentId) : [];

  return (
    <div className={`${maxHeightClass} overflow-y-auto`}>
      <div className="grid grid-cols-4 gap-1.5">
        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-[#C7BFE6] bg-white px-1 py-2 transition-colors hover:bg-[#F3EFFC]"
          >
            <IconAvatar icon="＋" size="sm" className="bg-[#F3EFFC] text-[#6F5FD6]" />
            <span className="line-clamp-1 text-[11px] font-medium text-[#6F5FD6]">新增</span>
          </button>
        )}
        {topCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${
              cat.id === activeParentId ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
            }`}
          >
            <IconAvatar icon={cat.icon} size="sm" className={categoryColorClass[cat.color]} />
            <span className="line-clamp-1 text-[11px] font-medium text-[#4A3B7C]">{cat.name}</span>
          </button>
        ))}
      </div>
      {subcategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onChange(sub.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sub.id === value ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
              }`}
            >
              {sub.icon} {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
