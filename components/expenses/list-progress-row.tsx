import type { ReactNode } from "react";
import { IconAvatar } from "./icon-avatar";
import { text } from "./theme";

/** 「圖示在左、上排名稱+金額、下排進度條+百分比」這套列的共用內容——資產總表的資產
 *  列表、報表的明細、總覽的本月預算／消費分類佔比都是同一種列，拆出來共用一份，不要
 *  四個地方各自手刻幾乎一樣的 JSX。只回傳內容（圖示＋文字區塊），不包外層容器：呼叫端
 *  有的要包可以點擊跳轉的 <Link>（資產列表），有的只是純展示的 <div>（報表/總覽），外層
 *  容器交給呼叫端自己決定。 */
export function ListProgressRow({
  icon,
  iconClassName,
  name,
  amount,
  pct,
  pctLabel,
  barColorHex,
  barColorClass,
}: {
  icon: string;
  /** IconAvatar 的底色/字色 class（例如 categoryColorClass[color]）；不傳就用預設淡紫底。 */
  iconClassName?: string;
  name: ReactNode;
  /** 右上角金額——字串或自訂 JSX（例如「已花 / 預算」這種組合文字）。 */
  amount: ReactNode;
  /** 進度條寬度百分比，會自動夾在 0–100 之間，超過 100 的實際數字只影響 pctLabel 不影響條寬。 */
  pct: number;
  /** 進度條右側顯示的文字，預設是 `${pct}%`——超過預算等情境可以自己傳不同文字/顏色。 */
  pctLabel?: ReactNode;
  /** 進度條顏色：兩種擇一，barColorHex 用 inline style（資產配置那種動態色票），
   *  barColorClass 用 Tailwind class（分類固定的 categoryFillClass，或超支時蓋成紅色）。 */
  barColorHex?: string;
  barColorClass?: string;
}) {
  const clampedPct = Math.min(100, Math.max(pct, 0));
  return (
    <>
      <IconAvatar icon={icon} size="sm" className={iconClassName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className={text.body}>{name}</span>
          <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">{amount}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3EFFC]">
            <div
              className={`h-full rounded-full ${barColorClass ?? ""}`}
              style={{ width: `${clampedPct}%`, ...(barColorHex ? { background: barColorHex } : {}) }}
            />
          </div>
          <span className={`shrink-0 tabular-nums ${text.faint}`}>{pctLabel ?? `${pct}%`}</span>
        </div>
      </div>
    </>
  );
}
