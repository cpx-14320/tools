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

/** 單一外部請求的逾時。開放資料的伺服器偶爾會很慢（查多天的行情實測過要好幾分鐘），
 *  沒有逾時的話一個慢掉的上游就能把整個 serverless function 卡到被平台砍掉。
 *  20 秒夠臺中那份 5MB 的檔案跑完，也不至於讓呼叫端等太久。 */
const REQUEST_TIMEOUT_MS = 20_000;

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

/* ───────────────────── 清理工具 ───────────────────── */

/** 開放資料裡的數值有時候是字串、有時候是 0 當缺值。轉不出正數就回 null（不要回 0——
 *  0 會被當成「這個東西不用錢」算進平均裡）。 */
export function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 民國年日期 → ISO。吃 `115.11.20` 與 `1151120` 兩種格式（兩支 API 各用一種）。 */
export function rocToISO(roc: string): string | null {
  const digits = roc.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // 民國年可能是 3 位（115）或 2 位（99 年以前），這裡的資料都是 3 位。
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
