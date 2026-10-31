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

/** ListCard 裡的一列：左邊圖示、中間名稱、右邊金額。
 *
 *  尺寸逐項對齊真的那一列，不是「差不多就好」——
 *  圖示 size-10（IconAvatar size="sm"，不是 size-9）、名稱那一行 h-5（text-sm 的行高
 *  20px）、進度條那一行 h-4（旁邊的百分比是 text-xs，行高 16px，決定這一行的高度的是
 *  文字不是那條 8px 的 bar）。差幾 px 乘上五六列就是肉眼看得到的一跳。 */
function RowSkeleton({ progress }: { progress: boolean }) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <div className={`size-10 shrink-0 animate-pulse rounded-xl ${SKELETON_BG}`} />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center justify-between gap-2">
          <SkeletonBar width="35%" />
          <SkeletonBar width="30%" />
        </div>
        {/* 有進度條的列（預算、帳戶類型）比一般列高一截，骨架也要跟著多這一條，
            不然切換到真資料時整張卡會抽高。 */}
        {progress && (
          <div className="mt-1.5 flex h-4 items-center">
            <SkeletonBar width="100%" height={8} />
          </div>
        )}
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

/** 日期膠囊的骨架——沿用真膠囊的外框跟兩顆箭頭，只有中間的日期換成灰條。
 *
 *  整顆畫成一塊灰圓角的話寬度會差一截（116 vs 真的 123），資料回來那一刻會抽一下。
 *  123×34 ＝ pl-1(4) + 箭頭 24 + gap(4) + 日期 53 + gap(4) + 箭頭 24 + pr-2(8) + 框線 2。 */
export function DatePillSkeleton() {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#ECE4FA] bg-white py-1 pl-1 pr-2">
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full text-[#DDD6F3]">
        ‹
      </span>
      <span className="h-5 w-[53px] animate-pulse rounded bg-[#EDE6FB]" />
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full text-[#DDD6F3]">
        ›
      </span>
    </div>
  );
}

/** 日期膠囊旁邊那幾顆 32px 圓形圖示鈕的骨架（日曆、篩選、鉛筆…）。
 *
 *  跟日期膠囊同一套做法：外框（那顆淡紫圓底）是真的，只有裡面的圖示換成灰塊。整顆塗成
 *  灰色的話，日期是白底帶框、旁邊卻是一坨實心灰，同一列兩種調性。 */
export function IconButtonSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F3EFFC]">
          <span className={`size-4 animate-pulse rounded ${SKELETON_BG}`} />
        </div>
      ))}
    </>
  );
}

/** 期間膠囊＋旁邊幾顆圖示鈕——掛在 PageHeader 的 actions 上，資料還沒回來時用這個
 *  頂著（見 DateFilterPicker）。 */
export function DateFilterPickerSkeleton({ icons = 1 }: { icons?: number }) {
  return (
    <div className="flex items-center gap-2">
      <DatePillSkeleton />
      <IconButtonSkeleton count={icons} />
    </div>
  );
}

/** 標題列的骨架：左邊標題、右邊日期膠囊＋幾顆圖示鈕。四頁的 PageHeader 長得一樣，
 *  骨架也共用同一份，不要各頁再各自拼一次（拼錯一次就差幾 px，資料回來整頁會跳）。 */
export function PageHeaderSkeleton({ titleWidth = 44, icons = 1 }: { titleWidth?: number; icons?: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <SkeletonBar width={titleWidth} height={20} />
      <div className="shrink-0">
        <DateFilterPickerSkeleton icons={icons} />
      </div>
    </div>
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
export function SectionSkeleton({
  count,
  progress = false,
  action = true,
  expandToggle = false,
}: {
  count: number;
  progress?: boolean;
  action?: boolean;
  /** 清單下面有「顯示全部 (N)／收合」那顆連結時也要畫，不然骨架會少一截
   *  （ExpandToggle ＝ mt-3 的 12px ＋ text-xs 的 16px 行高）。 */
  expandToggle?: boolean;
}) {
  return (
    <div>
      <SectionHeadingSkeleton action={action} />
      <ListCardSkeleton count={count} progress={progress} />
      {expandToggle && <ExpandToggleSkeleton />}
    </div>
  );
}

/** 區塊小標那一列：左邊標題、右邊可選的「查看全部」。高度照真的來（text-sm ＝ 20px）。 */
function SectionHeadingSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-2 flex h-5 items-center justify-between px-1">
      <SkeletonBar width={96} height={14} />
      {/* 小標右邊沒有「查看全部」那種連結的區塊傳 action={false}——留一條假的灰條
          在那裡，資料回來時那個位置會空掉，看起來像東西載失敗了。 */}
      {action && <SkeletonBar width={48} height={12} />}
    </div>
  );
}

/** 「顯示全部 (12)／收合」那顆連結的骨架——mt-3 ＋ 一行 text-xs。 */
function ExpandToggleSkeleton() {
  return (
    <div className="mt-3 flex h-4 justify-center">
      <SkeletonBar width={72} height={12} />
    </div>
  );
}

/** 依日期分組的清單骨架（首頁的「最近消費」）——每一組一個小標＋一張卡。
 *
 *  `shape` 是「每一組各有幾列」，來自 skeleton-count.ts 記住的上次形狀。只記總筆數的話
 *  沒辦法還原組數，畫成一張大卡就會少掉每一組之間的小標跟間距，資料回來時高度照樣跳。 */
export function GroupedSectionSkeleton({
  shape,
  action = true,
  expandToggle = false,
}: {
  shape: number[];
  action?: boolean;
  expandToggle?: boolean;
}) {
  return (
    <div>
      <SectionHeadingSkeleton action={action} />
      {shape.length === 0 ? (
        <ListCardSkeleton count={0} />
      ) : (
        <div className="flex flex-col gap-5">
          {shape.map((rows, i) => (
            <div key={i}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                {/* 96：日期小標是「2026-10-27 週一」，年月日後面還接了星期幾。 */}
                <SkeletonBar width={96} height={12} />
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
      {expandToggle && <ExpandToggleSkeleton />}
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

/** 「支出 NT$ 7,700」那種大數字摘要卡（報表頁最上面、消費紀錄頁的期間合計）。
 *
 *  排法照著真的那張卡：小標一行，底下 `mt-1 flex flex-col gap-1.5` 裝著金額跟漲跌幅，
 *  兩者是**上下**兩行。以前骨架是 `justify-between` 把漲跌幅排在金額右邊，所以載入時
 *  NT$ 右邊會多出一塊、資料回來又不見，那一塊憑空閃一下。
 *  高度也對齊真的元素（小標 16、金額 28＝text-lg 的行高、漲跌幅 16），資料回來整張卡
 *  才不會抽高。 */
export function SummaryCardSkeleton({ delta = false }: { delta?: boolean }) {
  return (
    <CardSkeleton>
      <SkeletonBar width={72} height={16} />
      <div className="mt-1 flex flex-col gap-1.5">
        <SkeletonBar width={148} height={28} />
        {delta && <SkeletonBar width={200} height={16} />}
      </div>
    </CardSkeleton>
  );
}

/** 年度對照表那張卡——標題、年份膠囊兩排、12 個月 ＋ 合計共 13 列的表格。
 *
 *  `rows` 是每一格要不要留「比前一年多／少多少」那一行的位置：挑一個年份時沒有可比的
 *  對象，整張表就矮一截。 */
export function YearCompareTableSkeleton({ withDelta = true }: { withDelta?: boolean }) {
  return (
    <CardSkeleton>
      <SkeletonBar width={96} height={20} />
      {/* 年份膠囊：h-7（px-3 py-1 的 text-xs ＝ 28px），通常會排成兩排。 */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`h-7 w-12 animate-pulse rounded-full ${SKELETON_BG}`} />
        ))}
      </div>
      <div className="mt-4">
        {Array.from({ length: 13 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-[#F2EEFA] py-2">
            <SkeletonBar width={28} height={16} />
            <div className="flex flex-col items-end gap-0.5">
              <SkeletonBar width={72} height={16} />
              {withDelta && i > 0 && <SkeletonBar width={56} height={12} />}
            </div>
          </div>
        ))}
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
      {/* 標題寬度跟著真的標題走："line"（淨額分頁）是「明細」兩個字，"rows"
          則是「分類佔比」「資產配置」四個字。 */}
      <SkeletonBar width={variant === "line" ? 48 : 64} height={14} />
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
            {/* 96：日期小標是「2026-10-27 週一」，年月日後面還接了星期幾。 */}
            <SkeletonBar width={96} height={12} />
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
