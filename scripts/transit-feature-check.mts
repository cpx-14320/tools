/** 搭乘車查詢（transit）功能回歸測試——每次改完 lib/transit/* 或那幾份縣市／站點清單
 *  之後跑一次。
 *
 *  ## 這支測什麼、不測什麼
 *
 *  **只測純函式與靜態資料**：時間與距離計算、縣市代碼對照、捷運站點與轉乘圖、高鐵站名、
 *  天氣的鄉鎮對照、API 快取分級。這些全部不用資料庫、不用 `.env.local`、**不會打 TDX**。
 *
 *  不打 TDX 是刻意的：那個帳號每分鐘只有 5 次額度（見 lib/transit/tdx-client.ts），
 *  一支會打外部 API 的測試腳本在 CI 上跑兩次就會把當下的額度用光，而且外部資料每天都在
 *  變，測試會莫名其妙地紅。要驗「TDX 真的回得了資料」是另一件事，手動跑一次就好。
 *
 *  **不測 UI**：版面、骨架對不對、按鈕接到哪，都要真的開瀏覽器走一遍。
 *
 *  ## 為什麼重點放在「兩份清單要對得起來」
 *
 *  這個工具最容易壞的地方不是演算法，是**同一件事寫在兩個檔案裡**：畫面上的縣市中文名
 *  （components/transit/bus-cities.ts、ubike-cities.ts）與伺服器端的縣市代碼對照
 *  （lib/transit/bus-routing.ts、ubike.ts）各維護一份，少一邊不會有任何錯誤訊息——
 *  使用者選了那個縣市，查詢就靜靜地回空清單。捷運的轉乘站與站點清單也是同一種關係。
 *
 *  用法：
 *    npx tsx scripts/transit-feature-check.mts
 *    npm run check:transit
 *
 *  結束碼：全部通過 0，有任何一項失敗 1。詳細報告寫到
 *  scripts/.transit-check-report.txt（已在 .gitignore）。
 */
import { writeFileSync } from "node:fs";

import { distanceMeters, formatDistance } from "../lib/geo";
import { formatDuration, minutesBetween } from "../lib/transit/tdx-time";
import { BUS_CITY_CODE } from "../lib/transit/bus-routing";
import { UBIKE_CITY_CODE } from "../lib/transit/ubike";
import { BUS_CITIES } from "../components/transit/bus-cities";
import { UBIKE_CITIES } from "../components/transit/ubike-cities";
import {
  findCrossSystemTransferStation,
  METRO_CROSS_CITY_GROUP,
  METRO_STATIONS_BY_CITY,
  METRO_SYSTEM_CODE,
  METRO_TRANSFER_HUBS,
  metroSystemOf,
} from "../lib/transit/metro-lines";
import { stationIdOf } from "../lib/transit/metro-routing";
import { THSR_STATION_ID } from "../lib/transit/tdx-stations";
import { DISTRICT_DATASET_ID, DISTRICTS_BY_CITY } from "../lib/transit/cwa-districts";
import { API_CACHE } from "../lib/transit/api-cache";
import { TDX_TTL } from "../lib/transit/tdx-client";

// ── 小小的測試工具（跟記帳本、菜鳥買菜記那兩支同一套）────────────────────────
const lines: string[] = [];
let passCount = 0;
let failCount = 0;

function log(s: string) {
  lines.push(s);
  console.log(s);
}

function section(name: string) {
  log(`\n■ ${name}`);
}

function check(label: string, cond: unknown, detail?: string) {
  if (cond) {
    passCount++;
    log(`  ✅ ${label}`);
  } else {
    failCount++;
    log(`  ❌ ${label}${detail ? `（${detail}）` : ""}`);
  }
}

/** 區塊裡丟出例外不會中斷整支腳本，記成一項失敗再往下跑——不然前面壞一個，後面全部看不到。 */
function run(name: string, fn: () => void) {
  section(name);
  try {
    fn();
  } catch (error) {
    failCount++;
    log(`  ❌ 整段拋出例外：${(error as Error).message}`);
  }
}

log("搭乘車查詢功能檢查（純函式與靜態資料，不連資料庫、不打 TDX）");

// ── 時間工具 ────────────────────────────────────────────────────────────────
run("時間工具", () => {
  check("同一天的兩個時間", minutesBetween("08:00", "09:30") === 90);
  check("整點到整點", minutesBetween("23:00", "23:00") === 0);
  // 終點字面上比起點小就是跨午夜——末班車（23:50 → 00:20）算出負數的話，畫面會顯示
  // 「-1410 分」這種東西。
  check("跨午夜當作隔天", minutesBetween("23:50", "00:20") === 30);
  check("跨午夜整夜", minutesBetween("22:00", "06:00") === 480);
  // TDX 的時刻表欄位有時候帶秒（"08:05:00"），函式靠 slice(0,5) 吃掉。
  check("帶秒數的時間字串也算得對", minutesBetween("08:05:00", "09:05:00") === 60);

  check("不到一小時只講分鐘", formatDuration(45) === "45 分");
  check("剛好一小時", formatDuration(60) === "1 時 0 分");
  check("一小時以上拆成時與分", formatDuration(125) === "2 時 5 分");
  check("零分鐘", formatDuration(0) === "0 分");
});

// ── 距離 ────────────────────────────────────────────────────────────────────
run("距離計算（附近站牌／站點排序用）", () => {
  const taipeiMain = { lat: 25.0478, lng: 121.5171 };
  const banqiao = { lat: 25.0139, lng: 121.4637 };
  const d = distanceMeters(taipeiMain.lat, taipeiMain.lng, banqiao.lat, banqiao.lng);
  // 台北車站到板橋站直線約 6 公里——只要量級對就好，這個函式是拿來排序不是導航。
  check("台北車站 ↔ 板橋站約 6 公里", d > 5_000 && d < 7_000, `${Math.round(d)} 公尺`);
  check("同一點距離是 0", distanceMeters(25, 121, 25, 121) === 0);
  check("距離是對稱的", Math.abs(distanceMeters(25, 121, 24, 120) - distanceMeters(24, 120, 25, 121)) < 1e-6);

  check("一公里以內講公尺", formatDistance(850) === "850 公尺");
  check("一公里以上講公里", formatDistance(1500) === "1.5 公里");
  check("剛好一公里是公里", formatDistance(1000) === "1.0 公里");
});

// ── 縣市清單：畫面與伺服器端兩邊要對得起來 ──────────────────────────────────
run("公車縣市清單（畫面 ↔ 伺服器代碼）", () => {
  const missingCode = BUS_CITIES.filter((city) => !BUS_CITY_CODE[city]);
  check("畫面上每個縣市都有 TDX 代碼", missingCode.length === 0, missingCode.join("、"));

  const orphanCode = Object.keys(BUS_CITY_CODE).filter((city) => !BUS_CITIES.includes(city));
  check("沒有選不到卻留著代碼的縣市", orphanCode.length === 0, orphanCode.join("、"));

  const codes = Object.values(BUS_CITY_CODE);
  check("TDX 代碼沒有重複", new Set(codes).size === codes.length);
  check("TDX 代碼都是英文", codes.every((c) => /^[A-Za-z]+$/.test(c)));

  // 檔頭寫明的刻意決定：苗栗縣 YouBike 有站點，但公車只查得到 1 條路線，所以不收。
  check("苗栗縣刻意不在公車清單裡", !BUS_CITIES.includes("苗栗縣"));
});

run("YouBike 縣市清單（畫面 ↔ 伺服器代碼）", () => {
  const missingCode = UBIKE_CITIES.filter((city) => !UBIKE_CITY_CODE[city]);
  check("畫面上每個縣市都有 TDX 代碼", missingCode.length === 0, missingCode.join("、"));

  const orphanCode = Object.keys(UBIKE_CITY_CODE).filter((city) => !UBIKE_CITIES.includes(city));
  check("沒有選不到卻留著代碼的縣市", orphanCode.length === 0, orphanCode.join("、"));

  // 兩份清單本來就不用一樣（各自依真實資料決定），但 YouBike 的服務範圍確實涵蓋公車的
  // 那幾個縣市——哪天反過來了，代表有人改錯了其中一份。
  const notCovered = BUS_CITIES.filter((city) => !UBIKE_CITIES.includes(city));
  check("YouBike 的縣市涵蓋公車的縣市", notCovered.length === 0, notCovered.join("、"));

  // 同一個縣市在兩份代碼表裡要是同一個代碼，不然同一個地方會查到兩種結果。
  const mismatched = Object.keys(BUS_CITY_CODE).filter((city) => UBIKE_CITY_CODE[city] && UBIKE_CITY_CODE[city] !== BUS_CITY_CODE[city]);
  check("公車與 YouBike 對同一個縣市用同一個代碼", mismatched.length === 0, mismatched.join("、"));
});

// ── 捷運 ────────────────────────────────────────────────────────────────────
run("捷運系統與站點清單", () => {
  const systems = Object.keys(METRO_STATIONS_BY_CITY);
  check("有站點清單的系統數", systems.length === 7, `${systems.length} 個`);

  const missingCode = systems.filter((s) => !METRO_SYSTEM_CODE[s]);
  check("每個系統都有 TDX 的 RouteSystemID", missingCode.length === 0, missingCode.join("、"));

  const orphanCode = Object.keys(METRO_SYSTEM_CODE).filter((s) => !METRO_STATIONS_BY_CITY[s]);
  check("沒有只有代碼卻沒有站點清單的系統", orphanCode.length === 0, orphanCode.join("、"));

  const all = Object.values(METRO_STATIONS_BY_CITY).flat();
  check("站點總數", all.length > 250, `${all.length} 站`);

  // 站點字串的形狀是「路線代碼＋站碼＋中文站名」（BL07板橋）。stationIdOf 靠這個格式
  // 取出 TDX 的 StationID，格式一破就查不到票價與行車時間。
  const badFormat = all.filter((s) => !/^[A-Za-z]+\d+[A-Za-z]?.+/.test(s));
  check("每一站都是「路線代碼＋站碼＋站名」", badFormat.length === 0, badFormat.slice(0, 3).join("、"));

  const dupInSystem = systems.filter((s) => new Set(METRO_STATIONS_BY_CITY[s]).size !== METRO_STATIONS_BY_CITY[s].length);
  check("同一個系統裡沒有重複的站", dupInSystem.length === 0, dupInSystem.join("、"));

  const noSystem = all.filter((s) => !metroSystemOf(s));
  check("metroSystemOf 每一站都找得到系統", noSystem.length === 0, noSystem.slice(0, 3).join("、"));
  check("不存在的站回 undefined", metroSystemOf("ZZ99不存在") === undefined);

  const crossMissing = METRO_CROSS_CITY_GROUP.filter((s) => !METRO_STATIONS_BY_CITY[s]);
  check("可跨系統查詢的系統都真的存在", crossMissing.length === 0, crossMissing.join("、"));
});

run("捷運轉乘站", () => {
  check("轉乘站數量", METRO_TRANSFER_HUBS.length >= 20, `${METRO_TRANSFER_HUBS.length} 個`);

  const ids = METRO_TRANSFER_HUBS.map((h) => h.id);
  check("轉乘站 id 沒有重複", new Set(ids).size === ids.length);

  // 轉乘站列的每一站都必須在某個系統的站點清單裡——打錯一個字（多一個「站」、少一個
  // 站碼）不會報錯，只會讓那個轉乘從此找不到。
  const ghost = METRO_TRANSFER_HUBS.flatMap((h) => h.stations.filter((s) => !metroSystemOf(s)).map((s) => `${h.name}:${s}`));
  check("轉乘站列的每一站都存在於站點清單", ghost.length === 0, ghost.slice(0, 3).join("、"));

  const tooFew = METRO_TRANSFER_HUBS.filter((h) => h.stations.length < 2);
  check("每個轉乘站至少串起兩個站點", tooFew.length === 0, tooFew.map((h) => h.name).join("、"));

  // 實際的跨系統查詢：兩個方向都要找得到，而且找到的是同一個轉乘站。
  const toAirport = findCrossSystemTransferStation("台北捷運", "桃園機場捷運");
  const fromAirport = findCrossSystemTransferStation("桃園機場捷運", "台北捷運");
  check("台北捷運 → 桃園機場捷運 找得到轉乘站", !!toAirport, JSON.stringify(toAirport));
  check("反方向也找得到同一個轉乘站", toAirport?.stationName === fromAirport?.stationName);

  /** 回傳的線代碼必須真的屬於「換乘之後要搭的那個系統」在這個轉乘站底下的某一站——
   *  這是 lineNo 唯一有意義的定義，寫死成某個字母反而會被轉乘站清單的順序左右
   *  （台北 ↔ 桃機 的第一個命中 hub 是台北車站，不是三重）。 */
  const lineBelongsTo = (hubName: string, destSystem: string, lineNo?: string) => {
    const hub = METRO_TRANSFER_HUBS.find((h) => h.name === hubName);
    return !!lineNo && !!hub?.stations.some((st) => metroSystemOf(st) === destSystem && st.startsWith(lineNo));
  };
  check("換乘後的線代碼屬於目的系統", lineBelongsTo(toAirport!.stationName, "桃園機場捷運", toAirport?.lineNo), JSON.stringify(toAirport));
  check("反方向的線代碼屬於台北捷運", lineBelongsTo(fromAirport!.stationName, "台北捷運", fromAirport?.lineNo), JSON.stringify(fromAirport));

  const toLrt = findCrossSystemTransferStation("台北捷運", "淡海輕軌");
  check("台北捷運 → 淡海輕軌 在紅樹林轉乘", toLrt?.stationName === "紅樹林" && toLrt?.lineNo === "V");

  check("同系統不需要轉乘", findCrossSystemTransferStation("台北捷運", "台北捷運") === undefined);
  // 高雄捷運不在可跨系統的群組裡，跟台北捷運之間不該湊出一個轉乘站。
  check("沒有轉乘關係的兩個系統回 undefined", findCrossSystemTransferStation("台北捷運", "高雄捷運") === undefined);
});

run("站碼解析（stationIdOf）", () => {
  check("一般站", stationIdOf("BL07板橋") === "BL07");
  check("單一字母路線", stationIdOf("A2三重站") === "A2");
  check("站碼帶尾碼", stationIdOf("R22A北投") === "R22A");
  check("沒有站碼時原樣回傳", stationIdOf("板橋") === "板橋");

  // 實際用站點清單跑一遍：每一站都要解析得出站碼，而且同一個系統裡不會解出重複的站碼。
  for (const [system, stations] of Object.entries(METRO_STATIONS_BY_CITY)) {
    const idsOf = stations.map(stationIdOf);
    const dup = idsOf.filter((id, i) => idsOf.indexOf(id) !== i);
    check(`${system} 的站碼都解析得出且不重複`, idsOf.every((id) => /^[A-Za-z]+\d+/.test(id)) && dup.length === 0, dup.slice(0, 3).join("、"));
  }
});

// ── 高鐵站名 ────────────────────────────────────────────────────────────────
run("高鐵站名對照", () => {
  const ids = new Set(Object.values(THSR_STATION_ID));
  check("高鐵有 12 站", ids.size === 12, `${ids.size} 站`);
  check("站號都是四位數字", Object.values(THSR_STATION_ID).every((id) => /^\d{4}$/.test(id)));

  // 台鐵站名用傳統字「臺」、高鐵用「台」，所以兩種寫法都要收，而且要指到同一個站號——
  // 少收一邊的話，使用者從台鐵頁面帶過來的站名就查不到。
  for (const [tai, tai2] of [["台北", "臺北"], ["台中", "臺中"], ["台南", "臺南"]]) {
    check(`「${tai}」與「${tai2}」都查得到且是同一站`, !!THSR_STATION_ID[tai] && THSR_STATION_ID[tai] === THSR_STATION_ID[tai2]);
  }
  check("站名不帶「站」字", Object.keys(THSR_STATION_ID).every((name) => !name.endsWith("站")));
});

// ── 天氣的鄉鎮對照 ──────────────────────────────────────────────────────────
run("天氣：鄉鎮與 CWA dataset 對照", () => {
  const cities = Object.keys(DISTRICTS_BY_CITY);
  check("22 個縣市都有鄉鎮清單", cities.length === 22, `${cities.length} 個`);

  const missingDataset = cities.filter((c) => !DISTRICT_DATASET_ID[c]);
  check("每個縣市都有 dataset ID", missingDataset.length === 0, missingDataset.join("、"));

  const orphanDataset = Object.keys(DISTRICT_DATASET_ID).filter((c) => !DISTRICTS_BY_CITY[c]);
  check("沒有只有 dataset ID 卻沒有鄉鎮清單的縣市", orphanDataset.length === 0, orphanDataset.join("、"));

  const datasetIds = Object.values(DISTRICT_DATASET_ID);
  check("dataset ID 格式都是 F-D0047-0NN", datasetIds.every((id) => /^F-D0047-\d{3}$/.test(id)));
  check("dataset ID 沒有重複", new Set(datasetIds).size === datasetIds.length);

  const districts = Object.values(DISTRICTS_BY_CITY).flat();
  check("全台 368 個區／鄉／鎮／縣轄市", districts.length === 368, `${districts.length} 個`);

  // 跨縣市同名是正常的（中正區在台北市與基隆市都有），但同一個縣市裡不能重複。
  const dupInCity = cities.filter((c) => new Set(DISTRICTS_BY_CITY[c]).size !== DISTRICTS_BY_CITY[c].length);
  check("同一個縣市裡沒有重複的區", dupInCity.length === 0, dupInCity.join("、"));

  // CWA 用的是傳統字「臺」，縣市名寫成「台北市」就查不到那個 dataset。
  const wrongChar = cities.filter((c) => c.startsWith("台"));
  check("縣市名用 CWA 的「臺」不是「台」", wrongChar.length === 0, wrongChar.join("、"));
});

// ── 快取分級 ────────────────────────────────────────────────────────────────
run("API 快取分級", () => {
  const entries = Object.entries(API_CACHE);
  check("每一級都是 private（不讓共用 CDN 快取）", entries.every(([, v]) => v.startsWith("private, max-age=")));

  const seconds = Object.fromEntries(entries.map(([k, v]) => [k, Number(v.replace("private, max-age=", ""))])) as Record<keyof typeof API_CACHE, number>;
  check("每一級都有秒數", Object.values(seconds).every((n) => Number.isFinite(n) && n > 0), JSON.stringify(seconds));

  // 分級要跟「資料多久會變」對得起來：即時到站 < 搜尋／時刻表 < 天氣 < 靜態清單。
  check("即時到站最短", seconds.realtime < seconds.search && seconds.realtime < seconds.timetable);
  check("搜尋與時刻表比天氣短", seconds.search < seconds.weather && seconds.timetable < seconds.weather);
  check("靜態清單最長", seconds.static > seconds.weather);

  // 瀏覽器那層不該比伺服器端的快取還久——不然伺服器資料都換新了，瀏覽器還在用舊的。
  check("即時到站的瀏覽器快取比伺服器端短", seconds.realtime * 1000 <= TDX_TTL.realtime);
  check("靜態清單的瀏覽器快取不超過伺服器端", seconds.static * 1000 <= TDX_TTL.static);
});

// ── 結果 ────────────────────────────────────────────────────────────────────
log(`\n──────────────────────────────`);
log(`通過 ${passCount} 項，失敗 ${failCount} 項`);

const reportPath = "scripts/.transit-check-report.txt";
writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
log(`詳細報告：${reportPath}`);

process.exit(failCount > 0 ? 1 : 0);
