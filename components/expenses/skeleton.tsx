import type { ReactNode } from "react";
import { Card, CardBody } from "./card";
import { EmptyListCard, ListCard } from "./list-row";

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

/** 一張 ListCard 的骨架——外框跟真的清單同一個（圓角、細框、列間分隔線）。
 *
 *  count 是 0 代表「上次這一區就是空的」，那時候畫面上出現的是一張 EmptyListCard
 *  （一行置中的說明），所以骨架也要畫成那個形狀、那個高度，不是畫 0 列變成一條
 *  扁扁的空框。 */
export function ListCardSkeleton({ count, progress = false }: { count: number; progress?: boolean }) {
  // 直接借 EmptyListCard 的外框，高度、邊框、陰影才會跟真的空卡一模一樣。
  if (count <= 0) {
    return (
      <EmptyListCard>
        <span className="inline-block align-middle">
          <SkeletonBar width={72} height={12} />
        </span>
      </EmptyListCard>
    );
  }
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

/** 依日期分組的清單骨架（首頁的「最近消費」）——每一組一個小標＋一張卡。
 *
 *  `shape` 是「每一組各有幾列」，來自 skeleton-count.ts 記住的上次形狀。只記總筆數的話
 *  沒辦法還原組數，畫成一張大卡就會少掉每一組之間的小標跟間距，資料回來時高度照樣跳。 */
export function GroupedSectionSkeleton({ shape }: { shape: number[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <SkeletonBar width={96} height={14} />
        <SkeletonBar width={48} height={12} />
      </div>
      {shape.length === 0 ? (
        <ListCardSkeleton count={0} />
      ) : (
        <div className="flex flex-col gap-5">
          {shape.map((rows, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                <SkeletonBar width={80} height={12} />
                <SkeletonBar width={64} height={12} />
              </div>
              <ListCard>
                {Array.from({ length: rows }, (_, r) => (
                  <RowSkeleton key={r} progress={false} />
                ))}
              </ListCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 一疊各自獨立的白卡（存錢目標、固定收支那種「一筆一張卡」的版面），不是一張卡切成
 *  好幾列。兩者的高度差很多：N 張卡有 N 份卡片內距跟 N-1 道間距，用 ListCardSkeleton
 *  充數的話資料回來整頁會往下掉一大截。每張卡長得一樣，所以 children 只要給一張的內容。 */
export function StackedCardsSkeleton({ count, gapClass = "gap-4", children }: { count: number; gapClass?: string; children: ReactNode }) {
  if (count <= 0) return <SkeletonBar width={220} height={12} />;
  return (
    <div className={`flex flex-col ${gapClass}`}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardBody>{children}</CardBody>
        </Card>
      ))}
    </div>
  );
}

/** 「主列＋底下幾個子列」的卡片一疊（收支分類、預算設定）。
 *
 *  shape[i] 是第 i 張卡底下有幾個子列。只記總數還原不出「哪張卡有幾個子項」，畫成一張
 *  大卡會少掉每張卡之間的間距跟淡色子區塊，高度一定對不上。 */
export function GroupedCardsSkeleton({ shape, footer = false }: { shape: number[]; footer?: boolean }) {
  if (shape.length === 0) return <SkeletonBar width={220} height={12} />;
  return (
    <div className="flex flex-col gap-3">
      {shape.map((subs, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
          <RowSkeleton progress={false} />
          {subs > 0 && (
            <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
              {Array.from({ length: subs }, (_, r) => (
                <div key={r} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <SkeletonBar width="30%" />
                  <SkeletonBar width={72} />
                </div>
              ))}
            </div>
          )}
          {/* 收支分類每張卡最後還有一列「＋ 新增子分類」。 */}
          {footer && (
            <div className="border-t border-[#ECE4FA] px-4 py-2">
              <SkeletonBar width={84} height={12} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** 「小標題＋一張清單卡」重複幾段（帳戶類型的資產／負債兩段）。counts[i] 是第 i 段有幾列，
 *  0 代表那一段整段不顯示——資產/負債其中一邊是空的時候，真的畫面上就沒有那個小標。 */
export function SectionedListSkeleton({ counts }: { counts: number[] }) {
  const sections = counts.filter((n) => n > 0);
  if (sections.length === 0) return <SkeletonBar width={220} height={12} />;
  return (
    <div className="flex flex-col gap-5">
      {sections.map((n, i) => (
        <div key={i}>
          <SkeletonBar width={32} height={14} className="mb-2 ml-1" />
          <ListCardSkeleton count={n} />
        </div>
      ))}
    </div>
  );
}

/** 一張白卡的骨架外框——內容自己傳，給各頁刻自己的形狀用。 */
export function CardSkeleton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** 「這段期間支出 NT$ 7,700」那種大數字摘要卡（報表頁最上面、消費紀錄頁的期間合計）。 */
export function SummaryCardSkeleton({ delta = false }: { delta?: boolean }) {
  return (
    <CardSkeleton>
      <SkeletonBar width={72} height={12} />
      <div className="mt-2 flex items-end justify-between gap-2">
        <SkeletonBar width={148} height={24} />
        {delta && <SkeletonBar width={96} height={12} />}
      </div>
    </CardSkeleton>
  );
}

/** 圓餅＋圖例＋底下的清單——報表頁「明細」／「資產配置」那張卡。
 *
 *  圖例的列數跟底下清單的列數是兩個不同的數字，要分開傳：圖例最多只列前幾名（報表頁的
 *  TOP_N），底下的清單則是每一個分類／每一個帳戶都有一列，資產分頁更是兩邊各自獨立
 *  （圖例是「資產類型」有幾種、清單是「資產帳戶」有幾個）。本來兩邊共用同一個 rows，
 *  資料回來時一定有一邊的高度是錯的。
 *
 *  legendRows 是 0 代表上次這張卡裡沒有圓餅，只有一行「這段期間還沒有◯◯紀錄。」，骨架
 *  也照那個形狀畫。 */
export function DonutCardSkeleton({
  legendRows,
  listRows,
  /** 底下那一段的樣子：`"rows"` 是一排帶進度條的分類／帳戶列（支出、收入、資產分頁）；
   *  `"line"` 是淨額分頁那一行「結餘　NT$ ◯◯」的單行總結。 */
  variant = "rows",
}: {
  legendRows: number;
  listRows?: number;
  variant?: "rows" | "line";
}) {
  return (
    <CardSkeleton>
      <SkeletonBar width={48} height={14} />
      {legendRows <= 0 ? (
        <SkeletonBar width={168} height={12} className="mt-3" />
      ) : (
        <>
          <div className="mt-4 flex items-center gap-5">
            <div className={`size-[120px] shrink-0 animate-pulse rounded-full ${SKELETON_BG}`} />
            <div className="flex flex-1 flex-col gap-2.5">
              {Array.from({ length: legendRows }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <SkeletonBar width="45%" height={10} />
                  <SkeletonBar width={36} height={10} />
                </div>
              ))}
            </div>
          </div>
          {variant === "line" ? (
            <div className="mt-5 flex items-center justify-between border-t border-[#F2EEFA] pt-4">
              <SkeletonBar width={32} height={14} />
              <SkeletonBar width={96} height={14} />
            </div>
          ) : (
            (listRows ?? 0) > 0 && (
              <div className="mt-5 flex flex-col gap-3 border-t border-[#F2EEFA] pt-4">
                {Array.from({ length: listRows ?? 0 }, (_, i) => (
                  <div key={i} className="flex w-full items-center gap-3">
                    <div className={`size-9 shrink-0 animate-pulse rounded-xl ${SKELETON_BG}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <SkeletonBar width="35%" />
                        <SkeletonBar width="30%" />
                      </div>
                      <SkeletonBar width="100%" height={8} className="mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </CardSkeleton>
  );
}

/** 趨勢卡：標題＋頻率切換、期間膠囊、一排長條。 */
export function TrendCardSkeleton() {
  return (
    <CardSkeleton>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SkeletonBar width={32} height={14} />
        <SkeletonBar width={148} height={30} className="rounded-full" />
      </div>
      <div className="mt-3 flex gap-1.5">
        {[56, 56, 64, 64].map((w, i) => (
          <SkeletonBar key={i} width={w} height={26} className="rounded-full" />
        ))}
      </div>
      <div className="mt-5 flex h-[150px] items-end gap-2">
        {[40, 70, 55, 85, 60, 95].map((h, i) => (
          <div key={i} className={`flex-1 animate-pulse rounded-t-md ${SKELETON_BG}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </CardSkeleton>
  );
}

/** 依日期分組、但沒有區塊小標的清單骨架（消費紀錄頁的列表）。
 *
 *  shape 是空的（上次這個分頁／這段期間就是沒有紀錄）時畫的是消費紀錄頁那張「這段期間
 *  還沒有支出紀錄。」的空卡——它是 py-10 的大留白卡，跟首頁那種 EmptyListCard 的矮卡
 *  不一樣，用錯一張資料回來時高度就會跳。 */
export function DateGroupsSkeleton({ shape }: { shape: number[] }) {
  if (shape.length === 0) {
    return (
      <Card>
        <CardBody className="flex justify-center py-10">
          <SkeletonBar width={160} height={12} />
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {shape.map((rows, i) => (
        <div key={i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
            <SkeletonBar width={80} height={12} />
            <SkeletonBar width={64} height={12} />
          </div>
          <ListCard>
            {Array.from({ length: rows }, (_, r) => (
              <RowSkeleton key={r} progress={false} />
            ))}
          </ListCard>
        </div>
      ))}
    </div>
  );
}
