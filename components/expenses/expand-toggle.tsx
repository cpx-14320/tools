"use client";

/** 長清單先只顯示前幾筆，剩下的收起來。 */
export const PREVIEW_COUNT = 5;

/** 清單底下置中的「顯示全部 (12)／收合」連結。
 *
 *  報表的分類明細、首頁的本月預算支出、首頁的最近消費都是同一種行為：預設只給前五筆，
 *  想看全部再按一下。本來只有報表頁有，其他地方是直接 slice(0, 5) 把多的藏起來、也沒有
 *  辦法展開，看起來像是只有這幾筆。收斂成這一顆共用的按鈕，三個地方的文字、字級、位置
 *  才會一致。
 *
 *  `label` 給「顯示全部」以外的說法用（例如最近消費是「顯示近七日」），括號裡的總數由
 *  這裡統一補上。 */
export function ExpandToggle({
  expanded,
  total,
  onToggle,
  label = "顯示全部",
}: {
  expanded: boolean;
  /** 展開後會看到幾筆——放在括號裡，讓人先知道按下去會多出多少東西。 */
  total: number;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <div className="mt-3 flex justify-center">
      <button type="button" onClick={onToggle} className="text-xs font-medium text-[#6F5FD6]">
        {expanded ? "收合" : `${label} (${total})`}
      </button>
    </div>
  );
}
