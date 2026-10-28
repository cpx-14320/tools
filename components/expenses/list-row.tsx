import type { ReactNode } from "react";
import Link from "next/link";
import { IconAvatar } from "./icon-avatar";
import { text } from "./theme";

/** 清單卡片外框——白底、圓角、細框，列與列之間一條淡淡的分隔線。預算設定、資產總表、
 *  帳戶類型、消費分類這幾頁的清單都是同一個外框，本來每頁各自複製一次這串 class。 */
export function ListCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white ${className}`}>
      {children}
    </div>
  );
}

/** 清單還沒有資料時擺在原地的那張卡——外框跟 ListCard 一模一樣，只是裡面放一行說明。
 *  空的時候整塊消失的話，版面會上下跳動，而且看不出「這裡本來有東西」。 */
export function EmptyListCard({ children = "還沒有任何資料" }: { children?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
      <div className="p-4 py-6 text-center text-xs text-[#9C94C4]">{children}</div>
    </div>
  );
}

/** 清單裡的一列：左邊圖示、中間名稱、右邊附註文字（金額／筆數／狀態），可選的右端箭頭。
 *
 *  把金額、進度條那些各頁不同的東西拿掉之後，預算設定的分類列、資產總表的負債列、
 *  帳戶類型的類型列、消費分類的分類列長得完全一樣，所以收斂成這一個元件。需要進度條的
 *  列仍然用 ListProgressRow（那是另一種「兩行、帶進度條」的列）。
 *
 *  外層容器依用途給 `href`（整列是連結）或 `onClick`（整列是按鈕）；兩個都不給就是
 *  純展示的一列。 */
export function ListRow({
  icon,
  iconClassName,
  name,
  right,
  leading,
  chevron = false,
  nested = false,
  href,
  onClick,
}: {
  icon?: string;
  /** IconAvatar 的底色/字色 class（例如 categoryColorClass[color]）；不傳就用預設淡紫底。 */
  iconClassName?: string;
  name: ReactNode;
  /** 右邊的附註：金額、「3 筆紀錄」、「未編預算」這類文字。 */
  right?: ReactNode;
  /** 名稱左邊、圖示更左邊的位置——目前只有多選模式的打勾圓點會用到。 */
  leading?: ReactNode;
  /** 右端的「›」，表示點了會進到另一個畫面或彈窗。 */
  chevron?: boolean;
  /** 上一層底下的子項目（資產總表「帳戶類型」底下的那幾個帳戶）：淡紫底＋往右縮排。
   *  子項目本來是裝在自己一張卡裡才看得出層級，整段併成一張卡之後靠這兩個記號區分。
   *  68px ＝ px-4 的 16 ＋ IconAvatar size="sm" 的 40 ＋ gap-3 的 12，剛好讓子項目的
   *  名稱對齊上一層的名稱，而不是對齊上一層的圖示。 */
  nested?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  // 縮排用一組完整的 padding 而不是在 px-4 後面再疊一個 pl-*：同時出現兩個 padding-left
  // 的 class 時，哪一個贏要看產出的 CSS 順序，不是寫在前面或後面。
  const className = `flex w-full items-center gap-3 py-3.5 text-left ${
    nested ? "bg-[#F9F7FE] pl-[68px] pr-4" : "px-4"
  }`;
  const content = (
    <>
      {leading}
      {icon !== undefined && <IconAvatar icon={icon} size="sm" className={iconClassName} />}
      <span className={`min-w-0 flex-1 truncate ${text.body}`}>{name}</span>
      {right !== undefined && <span className="shrink-0">{right}</span>}
      {chevron && (
        <span aria-hidden className="shrink-0 text-[#C7BFE6]">
          ›
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
