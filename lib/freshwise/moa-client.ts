// 伺服器端專用：只能從 Server Component 或 app/api/** 匯入，絕不能進到 "use client" 檔案。
//
// 這一層只負責「把開放資料原封不動拿回來」，不做任何品項對應或價格換算（那是
// prices.server.ts 的事）。四個來源都是免費、免金鑰的，所以這裡沒有任何秘密要藏——
// 分層的理由是「原始資料的怪癖集中在一個地方處理」。
//
// ## 實測過的怪癖（每一條都踩過）
//
// 1. 日期參數是 `StartDate`／`EndDate`，**不是**文件上寫的 `Start_time`／`End_time`。
//    給錯的參數名不會報錯，會被靜默忽略、直接回「最近四天」——所以很容易以為自己查到了
//    指定區間的資料。
// 2. 日期用民國年，而且兩支 API 格式不同：農產品 `115.11.20`（有點）、漁產品 `1151120`
//    （沒點）。格式給錯回空陣列，不是錯誤。
// 3. 分頁是 `$top`／`$skip`，單次上限 9999 筆。查多天一定會超過，要自己分頁。
// 4. 家禽行情的日期是**西元** `2026/11/18`，而且數值是字串。
// 5. 臺中零售那份是單一 JSON 檔（約 5MB、滾動一年、14 個市場），日期是西元 `20261118`，
//    缺價的欄位是字串 `"0"`（要當成「沒訪到」而不是 0 元），偶爾有離群的單位錯誤
//    （實際見過白蝦 7600 元/台斤）。

import { getDb } from "../mongodb";
import { toROC } from "./dates";

const MOA_BASE = "https://data.moa.gov.tw/Service/OpenData/FromM";
const TAICHUNG_RETAIL_URL =
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=495aff49-3547-4055-aacd-f0781c6f733e";

/** 單次請求的筆數上限（API 自己的限制）。 */
const PAGE_SIZE = 9999;
/** 分頁最多翻幾次。行情資料一天約 3,200 筆，這個上限夠查十天以上；設上限純粹是不要在
 *  API 行為改變時變成無窮迴圈。 */
const MAX_PAGES = 12;

/** 快取時間。行情是一天更新一次（農業部大約早上 10:30 放當天的資料），所以不需要用
 *  分鐘級的快取；設 3 小時是為了讓「早上先看過、中午資料才上來」的情況當天還能更新到。 */
const TTL = {
  /** 近幾天的行情（還可能補資料）。 */
  recent: 3 * 60 * 60 * 1000,
  /** 已經過去的日期，資料不會再變。 */
  settled: 7 * 24 * 60 * 60 * 1000,
  /** 臺中那份一年的檔案。 */
  retailFile: 6 * 60 * 60 * 1000,
} as const;

/* ───────────────────── 原始資料的型別 ───────────────────── */

export interface FarmRow {
  交易日期: string;
  作物代號: string;
  作物名稱: string;
  市場代號: string;
  市場名稱: string;
  上價: number;
  中價: number;
  下價: number;
  平均價: number;
  交易量: number;
}

export interface AquaticRow {
  交易日期: string;
  品種代碼: number;
  魚貨名稱: string;
  市場名稱: string;
  上價: number;
  中價: number;
  下價: number;
  交易量: number;
  平均價: number;
}

export interface PoultryRow {
  日期: string;
  [field: string]: string;
}

export interface TracedRow {
  交易日期: string;
  作物代號: string;
  作物名稱: string;
  市場代號: string;
  市場名稱: string;
  交易金額_元: string;
  交易量_公斤: string;
  /** 溯源代號。`X` 是沒有標章，其他代號是有標章（代碼表沒公開，見 fetchTracedRows）。 */
  溯源代號: string;
}

/** 糧價的一列。欄位名稱的意思見 fetchRiceRows。 */
export interface RiceRow {
  /** 縣市代碼（內政部的行政區代碼，例如 63000 臺北市）。 */
  CityName: string;
  /** 民國年、**不補零**，例如 `115.9.9`。 */
  pt_date_day: string;
  [field: string]: string | number;
}

/** 臺中零售的一列：市場名稱 ＋ 訪價日期 ＋ 幾十個品項欄位（值是字串價格）。 */
export interface TaichungRow {
  市場名稱: string;
  訪價日期: string;
  [item: string]: string;
}

/* ───────────────────── 兩層快取 ───────────────────── */

// 第一層：process 記憶體。存 promise 不是存值，順便讓同一個 instance 內的併發請求共用
// 同一次抓取（首頁、行情頁在同一個請求裡各自要資料時就是這個情況）。
const memCache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

interface CacheDoc {
  _id: string;
  data: unknown;
  expiresAt: Date;
}

/**
 * 包一層快取。
 *
 * **預設只快取在記憶體裡，不寫進 MongoDB。** 這跟搭乘車的 tdx-client 不一樣，理由是這些
 * 回應都很大：農產品行情一天約 3,200 筆，查八天就兩萬六千筆、六 MB 左右。實測把它寫進
 * 單一 Mongo 文件的代價是——
 *   - 每次頁面算繪都要從 Mongo 把那六 MB 搬回來（比只讀整理好的快照慢一個數量級），
 *   - 補歷史時連續寫十幾份好幾 MB 的文件，寫到連線被重設（ECONNRESET）。
 *
 * 而且這一層的持久化本來就是多餘的：整理好的「每日快照」已經存在 MongoDB 裡
 * （freshwise.snapshots），那才是真正的持久層；原始回應只要在同一個 function instance
 * 活著的期間不要重複抓就夠了。要不要去抓新的一天，由 prices.server.ts 的同步標記
 * （freshwise.syncMarkers）決定，不是靠這層快取。
 *
 * `persist: true` 只留給「回應很小」的來源（家禽行情約 5,900 筆、不到 1 MB）。
 */
function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, options?: { persist?: boolean }): Promise<T> {
  const persist = options?.persist === true;
  const hit = memCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise as Promise<T>;

  const promise = (async () => {
    const db = persist ? await getDb() : null;
    const coll = db?.collection<CacheDoc>("freshwise.sourceCache");

    const doc = coll ? await coll.findOne({ _id: key }) : null;
    if (doc && doc.expiresAt.getTime() > Date.now()) return doc.data as T;

    const data = await fetcher();

    // 快取寫入失敗不該讓這次查詢跟著失敗（使用者已經拿到資料了）。
    await coll
      ?.updateOne({ _id: key }, { $set: { data, expiresAt: new Date(Date.now() + ttlMs) } }, { upsert: true })
      .catch(() => {});

    return data;
  })();

  memCache.set(key, { promise, expiresAt: Date.now() + ttlMs });
  // 失敗不留快取，下一次請求可以重新嘗試。
  promise.catch(() => memCache.delete(key));
  return promise;
}

/** 單一外部請求的逾時。開放資料的伺服器很慢：實測單日的行情查詢 6～12 秒、臺中那份
 *  5MB 的檔案約 14 秒、而查三天的區間要 37 秒。沒有逾時的話一個慢掉的上游就能把整個
 *  serverless function 卡到被平台砍掉，所以設一個上限；25 秒容得下上面那些正常情況，
 *  又不會讓背景同步卡住太久。**要查一段期間的話一天一個請求**，不要靠加大這個數字。 */
const REQUEST_TIMEOUT_MS = 25_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`開放資料請求失敗：HTTP ${res.status} ${url}`);
  return (await res.json()) as T;
}

/** 分頁把一個區間的資料全部抓回來。回傳筆數剛好等於 PAGE_SIZE 就代表可能還有下一頁。 */
async function getAllPages<T>(baseUrl: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${baseUrl}&$top=${PAGE_SIZE}&$skip=${page * PAGE_SIZE}`;
    const rows = await getJson<T[]>(url);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

/* ───────────────────── 四個來源 ───────────────────── */

/**
 * 農產品交易行情（蔬菜、水果的批發行情，全國 22 個批發市場）。元/公斤。
 * 日期用民國年帶點：`115.11.20`。
 */
export function fetchFarmRows(startISO: string, endISO: string, settled = false): Promise<FarmRow[]> {
  const start = toROC(startISO);
  const end = toROC(endISO);
  return cached(`farm:${start}:${end}`, settled ? TTL.settled : TTL.recent, () =>
    getAllPages<FarmRow>(`${MOA_BASE}/FarmTransData.aspx?StartDate=${start}&EndDate=${end}`),
  );
}

/**
 * 漁產品交易行情（18 個魚市場）。元/公斤。
 * 日期用民國年**不帶點**：`1151120`——跟農產品那支不一樣，這是實測出來的，不是筆誤。
 */
export function fetchAquaticRows(startISO: string, endISO: string, settled = false): Promise<AquaticRow[]> {
  const start = toROC(startISO, "");
  const end = toROC(endISO, "");
  return cached(`aquatic:${start}:${end}`, settled ? TTL.settled : TTL.recent, () =>
    getAllPages<AquaticRow>(`${MOA_BASE}/AquaticTransData.aspx?StartDate=${start}&EndDate=${end}`),
  );
}

/**
 * 家禽交易行情（白肉雞、雞蛋）。元/台斤，日期是西元 `2026/11/18`，數值是字串。
 * 這支沒有日期參數可用（會回整段歷史，約 5,900 筆），所以一次抓回來自己挑日期。
 */
export function fetchPoultryRows(): Promise<PoultryRow[]> {
  // 這支的回應小（約 5,900 筆、不到 1 MB），存進 Mongo 划得來。
  return cached(`poultry:all`, TTL.recent, () => getJson<PoultryRow[]>(`${MOA_BASE}/PoultryTransBoiledChickenData.aspx`), {
    persist: true,
  });
}

/**
 * 臺中市公有零售市場每日蔬果價格。元/台斤，14 個市場，滾動一年，**含魚蝦文蛤、豬牛雞鴨肉
 * 與雞蛋鴨蛋**——這是唯一一份真正的零售訪價，也是這個工具預設場所（傳統市場）的資料來源。
 *
 * 原始檔約 5MB，所以只快取在記憶體裡，由 prices.server.ts 壓成每天一份精簡快照存進
 * MongoDB。
 */
export function fetchTaichungRetail(): Promise<TaichungRow[]> {
  return cached(`taichung:retail`, TTL.retailFile, () => getJson<TaichungRow[]>(TAICHUNG_RETAIL_URL));
}

/**
 * 產銷履歷與有機蔬果行情（AMIS）。**只有五個批發市場回報**（台北一、台北二、三重區、
 * 台中市、板橋區），每天晚上更新。
 *
 * 回傳的是交易金額與交易量，沒有單價——單價要自己用「金額 ÷ 量」算（這也是最誠實的
 * 算法，等於成交加權平均）。`溯源代號` 的代碼表沒有公開，但實測比對過：同一天同市場
 * 同作物的交易量加總幾乎等於農產品交易行情的總量，所以 `X` 就是「沒有標章」、其他代號
 * 是「有產銷履歷／有機之類的標章」。因為對不出哪個代號是哪一種標章，畫面上只分「有標章
 * ／一般」兩類，不宣稱是哪一種驗證。
 *
 * 日期參數跟農產品那支一樣是民國年帶點。
 */
export function fetchTracedRows(startISO: string, endISO: string, settled = false): Promise<TracedRow[]> {
  const start = toROC(startISO);
  const end = toROC(endISO);
  return cached(`traced:${start}:${end}`, settled ? TTL.settled : TTL.recent, () =>
    getAllPages<TracedRow>(`${MOA_BASE}/TAPData.aspx?StartDate=${start}&EndDate=${end}`),
  );
}

/**
 * 糧價（白米與稻穀）。**這是唯一一份全國各縣市、每天更新的零售價**——其他品項的零售訪價
 * 只有臺中市有，米是例外。
 *
 * 沒有日期參數，一次回最新的 9,999 筆（20 個縣市 × 約 500 天，等於一年半的歷史），
 * 所以一支請求就有完整歷史可以算走勢與划算度。
 *
 * 欄位命名要解釋一下：`pt_1*` 是零售價（元/公斤）、`pt_2*` 是批發價（**元/100 公斤**，
 * 要除以 100）、`pt_4*` 是稻穀價（溼穀，消費者買不到，不用）。後面那一段是米種：
 * jap＝蓬萊（梗米）、tsait＝在來硬、sangt＝在來軟、glutrt＝圓糯、glutlt＝長糯。
 */
export function fetchRiceRows(): Promise<RiceRow[]> {
  return cached(`rice:all`, TTL.recent, () =>
    getJson<RiceRow[]>(`${MOA_BASE}/RicepriceData.aspx?IsTransData=1&UnitId=266&$top=${PAGE_SIZE}`),
  );
}

/* ───────────────────── 清理工具 ───────────────────── */

/** 開放資料裡的數值有時候是字串、有時候是 0 當缺值。轉不出正數就回 null（不要回 0——
 *  0 會被當成「這個東西不用錢」算進平均裡）。 */
export function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 民國年日期 → ISO。**同一個平台有三種格式**，三種都要吃：
 *   - `115.11.20`　農產品交易行情（有點、補零）
 *   - `1151120`　　漁產品交易行情（無點、固定長度）
 *   - `115.9.9`　　糧價（有點、**不補零**）
 *
 * 不補零那種是後來接糧價才發現的：原本一律把非數字去掉再按固定長度切，`115.9.9` 會變成
 * 五個數字 `11599`、長度不足而被整批丟掉——症狀是「每個月的 1～9 日都沒有米價」，而且
 * 不會報錯。所以有點的格式一律按點切，不要用長度猜。
 */
export function rocToISO(roc: string): string | null {
  const text = String(roc ?? "").trim();

  if (text.includes(".")) {
    const parts = text.split(".");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map((part) => Number(part));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y + 1911}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // 民國年可能是 3 位（115）或 2 位（99 年以前），固定長度的那種資料都是 3 位。
  const year = Number(digits.slice(0, digits.length - 4)) + 1911;
  const month = digits.slice(-4, -2);
  const day = digits.slice(-2);
  return `${year}-${month}-${day}`;
}

/** 西元 `2026/11/18` 或 `20261118` → ISO。 */
export function adToISO(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}
