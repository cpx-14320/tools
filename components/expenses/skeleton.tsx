import { Card, CardBody } from "./card";
import { ListCard } from "./list-row";

/** 載入中的骨架元件庫。
 *
 *  原則跟搭乘車那份一樣（components/transit/skeleton.tsx）：**骨架的數量、每一列的高度、
 *  左右縮排都要跟載入完成後真正會顯示的內容一致**。骨架的用途是先把版面佔好，列數猜錯
 *  的話資料回來那一刻畫面會跳一下，比直接寫「載入中…」還糟。所以每個元件都要求呼叫端
 *  傳 `count`，而那個數字應該來自 skeleton-count.ts 記住的「上次實際筆數」。
 *
 *  尺寸刻意對齊 list-row.tsx：ListRow 是 `px-4 py-3.5` ＋ 36px 的 IconAvatar(sm)，
 *  ListProgressRow 多一條進度條，所以骨架也照這個排。 */

const SKELETON_BG = "bg-[#EDE6FB]";

/** 骨架的單一色塊。寬度用 % 或 px 字串都可以。 */
export function SkeletonBar({ width, height = 12, className = "" }: { width: number | string; height?: number; className?: string }) {
  return <div className={`animate-pulse rounded-full ${SKELETON_BG} ${className}`} style={{ width, height }} />;
}

/** ListCard 裡的一列：左邊圖示、中間名稱、右邊金額。對齊 ListRow 的尺寸。 */
function RowSkeleton({ progress }: { progress: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <div className={`size-9 shrink-0 animate-pulse rounded-xl ${SKELETON_BG}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <SkeletonBar width="35%" />
          <SkeletonBar width="30%" />
        </div>
        {/* 有進度條的列（預算、帳戶類型）比一般列高一截，骨架也要跟著多這一條，
            不然切換到真資料時整張卡會抽高。 */}
        {progress && <SkeletonBar width="100%" height={8} className="mt-2" />}
      </div>
    </div>
  );
}

/** 一張 ListCard 的骨架——外框跟真的清單同一個（圓角、細框、列間分隔線）。 */
export function ListCardSkeleton({ count, progress = false }: { count: number; progress?: boolean }) {
  return (
    <ListCard>
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} progress={progress} />
      ))}
    </ListCard>
  );
}

/** KPI 卡片的骨架（小標一行、數字一行）。 */
export function KpiCardSkeleton() {
  return (
    <Card>
      <CardBody className="p-3">
        <SkeletonBar width="40%" height={10} />
        <SkeletonBar width="65%" height={20} className="mt-2" />
      </CardBody>
    </Card>
  );
}

/** 「小標題在卡片外面、清單在卡片裡面」那種區塊的骨架（首頁的每一區、資產頁的帳戶區）。 */
export function SectionSkeleton({ count, progress = false }: { count: number; progress?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <SkeletonBar width={96} height={14} />
        <SkeletonBar width={48} height={12} />
      </div>
      <ListCardSkeleton count={count} progress={progress} />
    </div>
  );
}
