"use client";

import { IconAvatar } from "../icon-avatar";
import { text } from "../theme";
import { categoryById, categoryColorClass, categoryPath, displayCategoryOf, type CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AiDraftDTO, AiDraftItemDTO } from "@/lib/expenses/ai-drafts";

/** 待確認清單——AI 記帳的彈窗跟設定頁的批次詳情共用同一份。
 *
 *  每一列的重點是「這筆被歸到哪、對不對」，所以分類放在最顯眼的位置，金額靠右。
 *  沒分類的那幾列標橘色而不是紅色：那不是錯誤，是模型誠實說「我不確定」，紅色會讓人
 *  以為是壞掉了。 */
export function AiDraftList({
  draft,
  categories,
  onEdit,
  onSkip,
}: {
  draft: AiDraftDTO;
  categories: CategoryDTO[];
  onEdit: (item: AiDraftItemDTO) => void;
  onSkip: (item: AiDraftItemDTO) => void;
}) {
  const items = draft.items.filter((i) => i.state === "pending");
  if (items.length === 0) {
    return <p className={`px-1 ${text.faint}`}>這一批都處理完了。</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA]">
      {items.map((item) => {
        const category = item.categoryId ? categoryById(categories, item.categoryId) : undefined;
        const display = item.categoryId ? displayCategoryOf(categories, item.categoryId) : undefined;
        return (
          <div key={item.key} className="flex items-center gap-3 px-4 py-3">
            {display ? (
              <IconAvatar icon={display.icon} size="sm" className={categoryColorClass[display.color]} />
            ) : (
              // 未分類用一顆問號的空位，不要讓那一列比別人矮一截。
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FDF4E7] text-sm font-bold text-[#E0A33E]">？</span>
            )}
            <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
              <p className={`truncate ${text.body}`}>{item.note || category?.name || "（沒有備註）"}</p>
              <p className={item.categoryId ? text.muted : "text-xs font-medium text-[#E0A33E]"}>
                {item.categoryId ? categoryPath(categories, item.categoryId) : "尚未分類，點一下補上"}
                <span className={`ml-1.5 ${text.faint}`}>{formatDate(item.date)}</span>
              </p>
            </button>
            <span className="shrink-0 tabular-nums text-sm font-semibold text-[#4A3B7C]">－{formatCurrency(item.amount)}</span>
            <button type="button" onClick={() => onSkip(item)} className="shrink-0 text-xs font-medium text-[#9C94C4]">
              略過
            </button>
          </div>
        );
      })}
    </div>
  );
}
