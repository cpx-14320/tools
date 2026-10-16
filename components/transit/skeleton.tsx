/** 載入中的骨架元件庫。設計系統規定：**骨架的數量、每一列的高度、縮排都要跟載入完
 *  成後真正會顯示的內容一致**——骨架的用途是「先把版面佔好」，列數猜錯的話資料回來那
 *  一刻畫面高度會跳一下，比沒有骨架更糟。所以這裡的每個元件都要求呼叫端傳 `count`，
 *  而 count 應該來自 skeleton-count.ts 記住的「上次實際筆數」，不是隨便寫死一個數字。 */

import { colors, shadow } from "./theme";

/** 骨架的單一色塊。寬度用 % 或 px 字串都可以。 */
export function SkeletonBar({ width, height = 12, className = "" }: { width: number | string; height?: number; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-full ${className}`}
      style={{ width, height, backgroundColor: colors.skeleton }}
    />
  );
}

/** 一列「圖示 ＋ 幾行文字」的骨架，給備忘錄／常用行程／設定頁的清單共用。 */
export function ListRowSkeleton({ iconSize = 40, lines = 2 }: { iconSize?: number; lines?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="shrink-0 animate-pulse rounded-xl"
        style={{ width: iconSize, height: iconSize, backgroundColor: colors.skeleton }}
      />
      <div className="min-w-0 flex-1">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={i > 0 ? "mt-1.5" : ""}>
            <SkeletonBar width={i === 0 ? "70%" : "45%"} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 一疊白底卡片的骨架（備忘錄、常用行程那種每一列各自一張卡的清單）。 */
export function CardListSkeleton({ count, iconSize = 48, lines = 2 }: { count: number; iconSize?: number; lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl bg-white p-3" style={{ boxShadow: shadow.card }}>
          <ListRowSkeleton iconSize={iconSize} lines={lines} />
        </div>
      ))}
    </div>
  );
}

/** DividedCard（白底、列與列之間有分隔線）裡面的骨架列。 */
export function DividedRowsSkeleton({ count, iconSize = 40, lines = 2 }: { count: number; iconSize?: number; lines?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="px-4 py-3">
          <ListRowSkeleton iconSize={iconSize} lines={lines} />
        </div>
      ))}
    </>
  );
}

/** ScrollList（有外框、可內部捲動的清單）裡面的骨架列：左邊名稱、右邊徽章。 */
export function ScrollRowsSkeleton({ count, badge = true }: { count: number; badge?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-2 px-4 py-3">
          <SkeletonBar width={`${45 + ((i * 13) % 25)}%`} />
          {badge && <SkeletonBar width={44} height={16} />}
        </div>
      ))}
    </>
  );
}

/** 搜尋結果頁的班次卡骨架——欄位結構（上面兩行＋下面格線）跟真正的班次卡一致。 */
export function ResultCardSkeleton({ count, columns = 3 }: { count: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-[1.5rem] bg-white p-4" style={{ boxShadow: shadow.cardStrong }}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBar width="55%" height={14} />
              <div className="mt-1.5">
                <SkeletonBar width="35%" />
              </div>
            </div>
            <SkeletonBar width={56} height={18} />
          </div>
          <div className="mt-3 grid gap-2 border-t border-[#F2EEFA] pt-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, c) => (
              <div key={c} className="flex flex-col items-center gap-1.5">
                <SkeletonBar width={44} height={10} />
                <SkeletonBar width={32} height={12} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 公車站序／到站清單的骨架卡（結果頁公車模式每一站一張卡）。 */
export function StopCardSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4"
          style={{ boxShadow: shadow.cardStrong }}
        >
          <SkeletonBar width={`${40 + ((i * 11) % 25)}%`} height={14} />
          <SkeletonBar width={44} height={18} />
        </div>
      ))}
    </div>
  );
}
