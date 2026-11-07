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
        // 沒配到分類、但知道是哪個大分類時（「麥當勞」知道是餐飲、不知道哪一餐），用那個
        // 大分類的圖跟名字——總比一排問號好認，而且點進去就直接展開在那一類。
        const hint = !item.categoryId && item.categoryHintId ? categoryById(categories, item.categoryHintId) : undefined;
        const display = item.categoryId ? displayCategoryOf(categories, item.categoryId) : hint;
        // 正負號跟著分類的收支類型走，不能寫死減號：解析不分支出收入（收支方向由配到
        // 哪個分類決定），所以同一批裡會同時出現兩種。子分類的 kind 看它的大分類。
        const isIncome = display?.kind === "收入";
        return (
          <div key={item.key} className="flex items-center gap-3 px-4 py-3">
            {display ? (
              <IconAvatar icon={display.icon} size="sm" className={categoryColorClass[display.color]} />
            ) : (
              // 真的完全不知道的才用問號的空位，不要讓那一列比別人矮一截。
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FDF4E7] text-sm font-bold text-[#E0A33E]">？</span>
            )}
            <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-left">
              <p className={`truncate ${text.body}`}>{item.note || category?.name || "（沒有備註）"}</p>
              <p className={item.categoryId ? text.muted : "text-xs font-medium text-[#E0A33E]"}>
                {item.categoryId ? categoryPath(categories, item.categoryId) : hint ? `${hint.name} › 點一下選項目` : "尚未分類，點一下補上"}
                <span className={`ml-1.5 ${text.faint}`}>{formatDate(item.date)}</span>
              </p>
            </button>
            <span className={`shrink-0 tabular-nums text-sm font-semibold ${isIncome ? "text-[#2FAE82]" : "text-[#4A3B7C]"}`}>
              {isIncome ? "＋" : "－"}
              {formatCurrency(item.amount)}
            </span>
            <button type="button" onClick={() => onSkip(item)} className="shrink-0 text-xs font-medium text-[#9C94C4]">
              略過
            </button>
          </div>
        );
      })}
    </div>
  );
}
