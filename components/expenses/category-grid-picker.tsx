"use client";

import { OptionGrid } from "./option-grid";
import { text } from "./theme";
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
  onAddSubClick,
  maxHeightClass = "max-h-[260px]",
}: {
  categories: CategoryDTO[];
  kind: CategoryKind;
  value: string;
  onChange: (id: string) => void;
  onAddClick?: () => void;
  /** 「項目」那一排最後面多一顆「＋ 新增」，可以當場補一個子項目。收到的是目前選中的
   *  大分類 id。不給就不顯示那一顆。 */
  onAddSubClick?: (parentId: string) => void;
  maxHeightClass?: string;
}) {
  const activeParentId = value ? topLevelCategoryId(categories, value) : "";
  const subcategories = activeParentId ? subCategoriesOf(categories, activeParentId) : [];

  return (
    <div>
      {/* 只有上面的格子會捲動，下面的「項目」留在捲動範圍外——子分類是選完大分類之後
          緊接著的下一步，被捲走了就等於不存在。 */}
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
      </div>
      {/* 還沒有任何子項目、但可以當場新增時也要出現這一區（只有一顆「＋ 新增」）：
          在這個彈窗裡剛建好一個大分類之後，下一步常常就是替它補第一個子項目，沒有這一區
          的話只能關掉彈窗跑去設定頁。 */}
      {activeParentId && (subcategories.length > 0 || onAddSubClick) && (
        // 標一行「項目」：這排圓角選項跟上面的分類格子長得完全不一樣，不寫清楚的話
        // 會被當成另一組分類，不知道是在選剛剛那個分類底下的細項。
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={text.label}>項目</span>
            {/* 還停在大分類上就提醒一句，不要讓人按了儲存（灰的）之後才在猜哪裡沒填。
                一個子項目都還沒有的大分類本來就可以直接記在它身上，那時不用提醒。 */}
            {subcategories.length > 0 && value === activeParentId && (
              <span className="text-xs font-medium text-[#D1517E]">請選一個項目</span>
            )}
            {subcategories.length === 0 && <span className={text.faint}>可不填</span>}
          </div>
          <div className="flex flex-wrap gap-2">
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
            {/* 「這筆要記的項目這裡沒有」是記帳當下才會發現的事——沒有這顆就只能放棄這筆、
                跑去設定頁的分類設定補一則、再回來從頭填一次。虛線框跟實心的子項目區分開，
                看得出它是「新增」不是另一個可以選的項目。 */}
            {onAddSubClick && (
              <button
                type="button"
                onClick={() => onAddSubClick(activeParentId)}
                className="rounded-full border border-dashed border-[#C7BFE6] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]"
              >
                ＋ 新增
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
