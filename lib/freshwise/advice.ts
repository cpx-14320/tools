// 首頁的「今日快報」：今天該買什麼、該避開什麼，以及一句話的買菜建議。
//
// 這個工具的使用者不懂買菜價格，他要的不是一張價目表，而是一句「今天這個便宜、那個先別
// 買」。所以首頁的主角是這裡算出來的結論，價目表排在它後面。
//
// 整份都是純函式而且完全由資料推導，沒有亂數、沒有預先寫好的文案輪播——同一批資料永遠
// 得到同一句建議。這不只是為了可測試：首頁是 Server Component 先算好再傳給 client 元件，
// 兩邊算出不同的句子會讓 hydration 對不起來。

import { monthOf } from "./dates";
import { formatPriceIn, historyLabel, unitLabel } from "./price";
import type { PriceRow } from "./search";
import type { UnitKey } from "./types";

/** 快報每一區塊最多列幾項。手機一屏放得下三列，再多就得捲動才看得完，失去「快報」的
 *  意義（想看全部的人會去行情頁）。 */
export const BRIEF_LIMIT = 3;

export interface DailyBrief {
  /** 使用者的今天。 */
  today: string;
  /** 資料實際的日期。 */
  dataDate: string;
  /** 資料日期不等於今天——畫面上要標示，不要讓人以為看到的是今天的價。 */
  delayed: boolean;
  /** 今天最划算的幾項（跟自己近一年的均價比最便宜的）。 */
  cheapest: PriceRow[];
  /** 今天漲最多的幾項。 */
  risers: PriceRow[];
  /** 當季而且不貴的幾項——「現在正是吃這個的時候」。 */
  seasonal: PriceRow[];
  /** 一句話建議。 */
  advice: string;
  /** 清單上有幾項在漲、幾項在跌，給首頁的小計數用。 */
  upCount: number;
  downCount: number;
  /** 有幾項是推估值（不是實際訪價）。畫面上要讓使用者知道這件事的比重。 */
  estimatedCount: number;
  /** 總共有幾項有行情。 */
  total: number;
}

/**
 * 從清單列組出今天的快報。
 *
 * 兩條篩選規則，都是為了不要給出誤導的建議：
 *
 * 1. **划算度相關的區塊只收「歷史夠長」的品項**（`row.reliable`）——歷史只有幾天的品項，
 *    它的「平常價」只是這幾天的平均，拿來說「比平常便宜」是在編造結論。
 * 2. **實際訪價排在推估值前面**（`measuredFirst`）。全台只有臺中市公開零售訪價，其他品項
 *    的傳統市場價是用批發價推估的；推估值經過係數放大後波動更劇烈，很容易霸占「今天最
 *    划算」的前幾名（實測看到「比平常便宜 67%」這種推估出來的誇張數字）。有實際訪價的
 *    品項優先，推估值只在不夠湊滿三筆時才補上。
 */
export function buildBrief(rows: PriceRow[], todayISO: string, dataDate: string): DailyBrief {
  const month = monthOf(todayISO);

  const cheapest = measuredFirst(
    rows.filter((row) => row.reliable && row.value.level === "cheap"),
    (a, b) => a.value.percent - b.value.percent,
    BRIEF_LIMIT,
  );

  const risers = measuredFirst(
    rows.filter((row) => row.trend.direction === "up"),
    (a, b) => b.trend.percent - a.trend.percent,
  );

  // 當季區塊刻意排除「偏貴」的品項：當季卻比平常貴的東西（產季初期的搶鮮價）推薦給不懂
  // 價格的人只會讓他買貴，當季本身不是便宜的保證。歷史不夠長的品項判不出貴不貴，就讓它
  // 以「當季」的身分出現（不宣稱價格好壞）。
  const seasonal = measuredFirst(
    rows.filter((row) => row.inSeason && !(row.reliable && row.value.level === "pricey")),
    (a, b) => (a.reliable ? a.value.percent : 0) - (b.reliable ? b.value.percent : 0),
  );

  const upCount = rows.filter((row) => row.trend.direction === "up").length;
  const downCount = rows.filter((row) => row.trend.direction === "down").length;

  return {
    today: todayISO,
    dataDate,
    delayed: dataDate !== todayISO,
    cheapest,
    risers,
    seasonal,
    advice: buildAdvice({ month, cheapest, risers, seasonal, upCount, downCount, total: rows.length }),
    upCount,
    downCount,
    estimatedCount: rows.filter((row) => row.quote.estimated).length,
    total: rows.length,
  };
}

/**
 * 有實際訪價的排前面、推估值排後面，各自再照給定的規則排序。
 *
 * `limit` 不給就是全部回傳——「現在正當季」與「漲價了」在畫面上是可以展開的完整清單
 * （首頁用 CollapsibleList 收合），不該在資料層就砍掉。只有「今天值得買」是固定兩格的
 * 貨架，才需要在這裡限筆數。
 */
function measuredFirst(rows: PriceRow[], compare: (a: PriceRow, b: PriceRow) => number, limit?: number): PriceRow[] {
  const measured = rows.filter((row) => !row.quote.estimated).sort(compare);
  const estimated = rows.filter((row) => row.quote.estimated).sort(compare);
  const all = [...measured, ...estimated];
  return limit === undefined ? all : all.slice(0, limit);
}

/**
 * 一句話建議。優先順序是「有便宜的就先講便宜的」→「沒有便宜的但有大漲的就講要避開
 * 什麼」→「有當季的就講當季」→「都沒事就說今天平穩」。
 *
 * 句子裡的品項優先挑「有實際訪價」的——頭條建議是整個首頁最顯眼的一句話，拿推估值
 * 當主角不妥。
 *
 * 不講「蔬菜類今日下跌 3.2%」這種聽起來很專業但沒辦法照著做的句子。使用者要的是「今天
 * 買什麼」，所以句子裡一定要有具體品項名稱。
 */
function buildAdvice({
  month,
  cheapest,
  risers,
  seasonal,
  upCount,
  downCount,
  total,
}: {
  month: number;
  cheapest: PriceRow[];
  risers: PriceRow[];
  seasonal: PriceRow[];
  upCount: number;
  downCount: number;
  total: number;
}): string {
  if (total === 0) return "今天還沒有行情資料，等等再回來看看。";

  const best = cheapest.find((row) => !row.quote.estimated) ?? cheapest[0];
  if (best) {
    const abs = Math.abs(best.value.percent);
    const seasonWord = best.inSeason ? `${month} 月正當季，` : "";
    const estimateWord = best.quote.estimated ? "（推估）" : "";
    return `${seasonWord}今天的${best.item.name}比平常便宜 ${abs}%${estimateWord}，很適合買。`;
  }

  const worst = risers.find((row) => !row.quote.estimated) ?? risers[0];
  if (worst && worst.trend.percent >= 10) {
    return `今天的${worst.item.name}漲了 ${worst.trend.percent}%，可以先避開，改買同類的其他品項。`;
  }

  const inSeason = seasonal[0];
  if (inSeason) return `${month} 月的${inSeason.item.name}正當季，這時候的品質通常最好。`;

  if (downCount > upCount) return "今天整體行情偏軟，大部分品項比昨天便宜一些。";
  if (upCount > downCount * 2) return "今天多數品項在漲，建議只買當天要用的量。";
  return "今天價格大致平穩，照平常的買法就可以。";
}

/** 快報裡每一列的右側說明文字。 */
export function briefReason(row: PriceRow, kind: "cheap" | "rise" | "season"): string {
  if (kind === "rise") return `比前一個交易日漲 ${Math.abs(row.trend.percent)}%`;
  if (kind === "season") {
    if (!row.reliable) return "當季盛產";
    return row.value.level === "cheap" ? `當季・比平常便宜 ${Math.abs(row.value.percent)}%` : "當季・正常價";
  }
  return `比${historyLabel(row.quote.historyDays)}的平均便宜 ${Math.abs(row.value.percent)}%`;
}

/** 「高麗菜 32 元/台斤」這種一行摘要。 */
export function rowSummary(row: PriceRow, unit: UnitKey): string {
  return `${row.item.name} ${formatPriceIn(row.quote.avgKg, unit)} ${unitLabel(unit)}`;
}
