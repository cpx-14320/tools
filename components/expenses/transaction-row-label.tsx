import type { ReactNode } from "react";
import { IconAvatar } from "./icon-avatar";
import { text } from "./theme";

/** 交易列的「圖示＋標題＋副標」文字區塊——首頁最近消費（標題＝備註/分類名稱，副標＝
 *  日期）、消費紀錄列表、帳戶明細列表（標題＝備註/分類名稱，副標＝分類路徑）都是同一套
 *  長相，本來三個地方各自複製一份幾乎一樣的 JSX，字重／顏色很容易改了一處忘了改另外
 *  兩處（就是「最近消費」字重跟「收入來源」對不齊那次）。統一成這一個，標題固定用
 *  `text.body`、副標固定用 `text.muted`，之後要調整文字樣式只要改一個地方。
 *
 *  只回傳內容（圖示＋文字區塊），不包外層容器——呼叫端有的要包 `<li>`（首頁），有的要包
 *  `<button>`（可以點開編輯），外層容器交給呼叫端自己決定，跟 ListProgressRow 同一個
 *  做法。 */
export function TransactionRowLabel({
  icon,
  iconClassName,
  title,
  subtitle,
}: {
  icon: string;
  /** IconAvatar 的底色/字色 class（例如 categoryColorClass[color]）；不傳就用預設淡紫底。 */
  iconClassName?: string;
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <>
      <IconAvatar icon={icon} size="sm" className={iconClassName} />
      <div className="min-w-0 flex-1">
        <p className={`truncate ${text.body}`}>{title}</p>
        <p className={`truncate ${text.muted}`}>{subtitle}</p>
      </div>
    </>
  );
}
