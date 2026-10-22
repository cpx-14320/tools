"use client";

import { OptionGrid } from "./option-grid";
import {
  topLevelCategories,
  subCategoriesOf,
  categoryColorClass,
  topLevelCategoryId,
  type CategoryDTO,
  type CategoryKind,
} from "@/lib/expenses/categories";

/** 分類格子選擇器——取代原生 `<select>`：頂層分類排成格子（共用的 OptionGrid，跟新增
 *  帳戶的類型格子同一個元件），選到的如果有子分類會在下面展開一排圓角選項可以再選
 *  更細的。新增交易彈窗、固定收支彈窗都共用這一個，不要兩邊各刻一份幾乎一樣的格子。
 *  `onAddClick` 不給的話就不顯示「＋新增」那一格。 */
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
  const activeParentId = value ? topLevelCategoryId(categories, value) : "";
  const subcategories = activeParentId ? subCategoriesOf(categories, activeParentId) : [];

  return (
    <div className={`${maxHeightClass} overflow-y-auto`}>
      <OptionGrid
        options={topLevelCategories(categories, kind).map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          colorClass: categoryColorClass[c.color],
        }))}
        value={activeParentId}
        onChange={onChange}
        onAddClick={onAddClick}
      />
      {subcategories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onChange(sub.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                sub.id === value ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
              }`}
            >
              {/* 只有文字、不放圖示：子分類目前全部共用同一張佔位圖，每一顆都掛一個
                  一模一樣的小圖等於只是把字擠窄，分辨不出任何東西。 */}
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
