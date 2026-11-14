"use client";

import { ListCard } from "../list-row";
import { TransactionRowLabel } from "../transaction-row-label";
import { text } from "../theme";
import { categoryById, categoryColorClass, categoryPath, displayCategoryOf, type CategoryDTO } from "@/lib/expenses/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AiDraftDTO, AiDraftItemDTO } from "@/lib/expenses/ai-drafts";

/** 待確認清單——AI 記帳的彈窗跟「待確認的解析結果」詳情頁共用同一份。
 *
 *  **整份比照明細頁的消費清單**：白底卡片（ListCard）＋ 圖示、標題、分類路徑、靠右金額
 *  （TransactionRowLabel），跟使用者確認完之後會看到的那份清單長得一模一樣——這裡列的
 *  本來就是「等一下會變成那幾列」的東西，兩邊長得不一樣只會讓人多比對一次。本來這裡是
 *  自己刻的一張透明底卡片，疊在同樣是淡紫的頁面背景上看起來像沒有卡片。
 *
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
    <ListCard>
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
          <div key={item.key} className="flex w-full items-center gap-3 px-4 py-3">
            <button type="button" onClick={() => onEdit(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {display ? (
                <TransactionRowLabel
                  icon={display.icon}
                  iconClassName={categoryColorClass[display.color]}
                  title={item.note || category?.name || "（沒有備註）"}
                  subtitle={
                    <>
                      {item.categoryId ? (
                        categoryPath(categories, item.categoryId)
                      ) : (
                        <span className="font-medium text-[#E0A33E]">{hint ? `${hint.name} › 點一下選項目` : "尚未分類，點一下補上"}</span>
                      )}
                      <span className={`ml-1.5 ${text.faint}`}>{formatDate(item.date)}</span>
                    </>
                  }
                />
              ) : (
                // 完全不知道是哪一類時，圖示那一格放一個橘色問號——位置跟尺寸仍然走
                // IconAvatar，那一列才不會比別人矮一截、文字起點也對得齊。
                <TransactionRowLabelFallback
                  title={item.note || "（沒有備註）"}
                  date={formatDate(item.date)}
                />
              )}
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
    </ListCard>
  );
}

/** 連大分類都判不出來的那一列：橘色問號＋「尚未分類」。拆成一個小元件只是為了讓上面
 *  那段三元運算子不要再多包兩層，兩種情況的排版（40px 圖示＋兩行文字）完全一樣。 */
function TransactionRowLabelFallback({ title, date }: { title: string; date: string }) {
  return (
    <TransactionRowLabel
      icon="？"
      iconClassName="bg-[#FDF4E7] text-[#E0A33E]"
      title={title}
      subtitle={
        <>
          <span className="font-medium text-[#E0A33E]">尚未分類，點一下補上</span>
          <span className={`ml-1.5 ${text.faint}`}>{date}</span>
        </>
      }
    />
  );
}
