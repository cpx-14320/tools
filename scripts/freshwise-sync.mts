/** 菜鳥不買貴——行情同步腳本。
 *
 *  網頁本身每次算繪都會確保「最近幾天」的行情是新的（見 lib/freshwise/prices.server.ts 的
 *  ensureFresh），所以**正常使用不需要跑這支**。這支是給兩種情況用的：
 *
 *  1. **第一次上線的暖機**：批發行情的歷史沒辦法在一次頁面算繪裡補完（農業部那支只能按
 *     日期區間查，一年等於上百萬筆、十幾次分頁請求）。跑一次這支把過去幾十天補起來，
 *     「比近一年平均便宜 X%」這類判斷才有足夠的歷史可以講（門檻是 30 天）。
 *     臺中的零售資料不需要暖機——那份檔案本身就是滾動一年，一抓就有。
 *
 *  2. **排程**：掛成每天的 cron（例如每天 11:00，農業部大約上午公布當天行情），
 *     讓第一個開頁面的使用者不用等那幾次外部請求。
 *
 *  用法：
 *    npx tsx scripts/freshwise-sync.mts            # 同步今天的資料（零售一年＋產地價＋批發最近 8 天）
 *    npx tsx scripts/freshwise-sync.mts --days 60  # 另外往回補 60 天的批發歷史
 *    npm run sync:freshwise
 *
 *  結束碼：成功 0，失敗 1。
 */
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const uriMatch = /^MONGODB_URI=(.*)$/m.exec(env);
const uri = (uriMatch ? uriMatch[1] : "").trim().replace(/^["']|["']$/g, "");
if (!uri) throw new Error("在 .env.local 找不到 MONGODB_URI");
process.env.MONGODB_URI = uri;

// 動態 import：一定要等上面把 MONGODB_URI 塞進 process.env 之後才能載入這些模組，
// 不然 lib/mongodb.ts 的 getDb() 第一次被呼叫時會抓不到連線字串。
const { backfillWholesale, ensureFresh, syncAll } = await import("../lib/freshwise/prices.server");
const { getDb } = await import("../lib/mongodb");

const daysArg = process.argv.indexOf("--days");
const backfillDays = daysArg >= 0 ? Number(process.argv[daysArg + 1]) : 0;

function log(message: string) {
  console.log(`[${new Date().toLocaleTimeString("zh-TW", { hour12: false })}] ${message}`);
}

const started = Date.now();
let failed = false;

try {
  log("同步零售（臺中・一年）與產地價…");
  const { retail, origin } = await syncAll((message) => log(`  · ${message}`));
  log(`零售 ${retail} 天、產地價 ${origin} 天`);

  log("同步最近幾天的批發行情…");
  await ensureFresh();

  if (Number.isFinite(backfillDays) && backfillDays > 0) {
    log(`往回補 ${backfillDays} 天的批發歷史（這一段比較慢，一次抓 5 天）…`);
    const written = await backfillWholesale(backfillDays, (message) => log(`  · ${message}`));
    log(`批發歷史寫入 ${written} 天`);
  }

  // 報告一下現在資料庫裡有什麼，確認真的有寫進去。
  const db = await getDb();
  const snapshots = db.collection("freshwise.snapshots");
  const series = db.collection("freshwise.series");

  const [snapCount, seriesDocs] = await Promise.all([snapshots.countDocuments(), series.find({}).toArray()]);
  const byVenue = new Map<string, number>();
  for (const doc of seriesDocs) {
    const venue = String(doc.venue);
    byVenue.set(venue, Math.max(byVenue.get(venue) ?? 0, Number(doc.stats?.days ?? 0)));
  }

  log(`資料庫現況：${snapCount} 份每日快照、${seriesDocs.length} 條走勢`);
  for (const [venue, days] of byVenue) log(`  · ${venue}：最長歷史 ${days} 天`);

  const latest = await snapshots.find({}, { sort: { date: -1 }, limit: 1 }).toArray();
  if (latest[0]) log(`最新資料日期：${latest[0].date}`);

  const notEnough = [...byVenue.entries()].filter(([, days]) => days < 30);
  if (notEnough.length > 0) {
    log(`提醒：${notEnough.map(([v]) => v).join("、")} 的歷史還不到 30 天，畫面上不會顯示「比近一年平均…」。`);
    log(`      想立刻補起來的話跑：npx tsx scripts/freshwise-sync.mts --days 45`);
  }
} catch (error) {
  failed = true;
  console.error("同步失敗：", error);
}

log(`結束，共 ${Math.round((Date.now() - started) / 1000)} 秒`);
process.exit(failed ? 1 : 0);
