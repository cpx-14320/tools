# 搭乘車查詢（transit）— 規則與執行規範

> 這份是 2026-11-27 建立的：這個工具以前沒有獨立文件，規則散在各檔案的檔頭註解裡
> （那些註解寫得很完整，是這份的來源）。**色票、字級、間距在 [design.md](design.md)**
> ——改樣式讀那份，這份不重複。跨工具共通的規則在 [../README.md](../README.md)。

## 0. 這個工具要解決什麼

查固定通勤的班次時刻表，誤點或即將到站時提醒。使用者是「每天搭同一條線」的人，所以常用行程
（`frequent-trips`）是主角，不是一次性的路線搜尋。

## 1. 外部 API：額度是最硬的限制

| 來源 | 用途 | 限制 |
| --- | --- | --- |
| TDX（運輸資料流通服務） | 台鐵／高鐵／捷運／公車／YouBike | **每分鐘 5 次**（實測 `RateLimit-Limit` header） |
| CWA（中央氣象署） | 36 小時與鄉鎮天氣預報 | 沒有嚴格的每分鐘限制，但更新本來就慢 |

每分鐘 5 次意味著**冷快取時一次查詢就可能打滿額度**（查一個縣市的公車站牌清單要 10 個請求）。
所以快取是三層，每一層解決不同的問題：

1. **process 記憶體快取**（`tdx-client.ts` 的 `memCache`）——同一個還熱著的 function instance
   連續打同個 path 不用等 Mongo。它**存 promise 不是存值**，所以同一 instance 內的併發請求
   大家等同一個 promise，不會各自真的打一次 TDX。
2. **MongoDB 快取**（`transit.tdxCache`）——serverless 冷啟動後記憶體快取就沒了，這層還在。
   TTL 分三級：`realtime`（60 秒）／`dailyTimetable`（6 小時）／`static`（24 小時）。
3. **瀏覽器 HTTP 快取**（`api-cache.ts` 的 `API_CACHE`）——前兩層只擋得住「真的去打外部 API」，
   瀏覽器每次換頁、每次重開彈窗還是會打一次我們自己的 API route（一趟 serverless function
   ＋ Mongo 查詢）。掛上 `Cache-Control` 之後這些重複請求連送都不會送。

`API_CACHE` 一律用 `private`（回應跟登入的使用者有關，不該被共用 CDN 快取），時間分級跟
`TDX_TTL` 對應：`static` 86400／`search` 300／`timetable` 300／`realtime` 30／`weather` 1800。

### 幾乎不會變的資料寫死，不要每次都打 API

- `metro-lines.ts`：全台捷運／輕軌的站點清單（從 TDX `v2/Rail/Metro/StationOfLine/{系統代碼}`
  查回來寫死）。左欄的 key 用**系統名稱**不是行政區——捷運路線常橫跨好幾個縣市。
- `tdx-stations.ts`：站名 → `StationID` 對照，只收錄這個工具實際用到的站。
  **台鐵站名用傳統字「臺」、高鐵用「台」**，兩邊都收「台／臺」兩種寫法方便查表。
- `bus-cities.ts` / `ubike-cities.ts`：中文縣市名 ↔ TDX 英文城市代碼。YouBike 的服務範圍比
  公車查詢共用的四個縣市廣，兩份各自維護，但中文名稱要對得起來。
- `cwa-districts.ts`：CWA 的鄉鎮預報（F-D0047 系列）**每個縣市是獨立的 dataset**，不像
  F-C0032-001 一個 ID 查全國。所以要先知道某個區屬於哪個縣市，換成對應的 dataset ID。

## 2. 金鑰絕對不能進前端 bundle

`tdx-client.ts`、`cwa-client.ts` 的檔頭第一行就寫了：**只能從 `app/api/**` 的 route handler
匯入，絕不能進到 `"use client"` 檔案**，否則 `TDX_CLIENT_SECRET` / `CWA_API_KEY` 會被打包進去。

瀏覽器端需要同一份資料時，另外寫一個不碰金鑰的 client 版——`train-cities-client.ts` 就是
為此存在（台鐵約 240 站的清單與快取），它刻意**不從 `tdx-stations.ts` import 任何東西**，
因為那個檔案會連到金鑰與 mongodb 驅動程式。

TDX 的 token 請求用 `URLSearchParams` 編碼，不要字串拼接——`clientSecret` 裡只要有
`& = + % ? #` 或空白，TDX 就會把 body 解析錯誤回 400。

## 3. 畫面

- 樣式一律照 [design.md](design.md)：色票是紫（`ink #4A3B7C`、
  `brand #6F5FD6`），主要按鈕走 `gradient.primary` ＋ `shadow.cta`。
  **不要出現 token 以外的新數字、新顏色、新字級。**
- **這個工具還在用骨架（skeleton）**，是五個工具裡唯一的，而且**確認要繼續用**。
  所以**改版面就要同步改 `components/transit/skeleton.tsx` 與 `skeleton-count.ts`**——
  骨架跟實際版面長得不一樣時，載入完成的瞬間會整頁跳動，比沒有骨架更糟。
  哪些清單該畫骨架、列數怎麼決定、空清單為什麼不畫，完整規則在
  [design.md](design.md) 的「骨架（載入中）」一節，這裡不重複。
- 時間色：`positive` 準時／充裕、`warning` 誤點／3 分鐘內到站、`negative` 進站中。
- 只有手機版版面（寬螢幕是置中的手機框），跟另外兩個工具一致。

## 4. 怎麼驗

```
npx tsc --noEmit
npx eslint app components lib scripts
npm run check:transit        # 純函式與靜態資料，不用資料庫、不打 TDX
```

`scripts/transit-feature-check.mts` 測六段：時間工具（跨午夜、帶秒數的時間字串）、距離計算、
公車與 YouBike 的縣市清單、捷運站點與轉乘圖、高鐵站名、天氣的鄉鎮對照、API 快取分級。

**重點放在「同一件事寫在兩個檔案裡」**，因為那是這個工具最容易壞的地方：畫面上的縣市中文名
（`components/transit/bus-cities.ts`、`ubike-cities.ts`）與伺服器端的縣市代碼
（`lib/transit/bus-routing.ts`、`ubike.ts`）各維護一份，少一邊**不會有任何錯誤訊息**——
使用者選了那個縣市，查詢就靜靜地回空清單。捷運的轉乘站與站點清單、天氣的鄉鎮與 dataset ID
也是同一種關係。

**刻意不打 TDX**：每分鐘 5 次的額度禁不起 CI 跑兩次，而且外部資料每天都在變，測試會莫名
其妙地紅。因此 `computeMetroTrip`（最短路徑）與公車搜尋這類一定要外部資料的函式不在範圍內
——要驗「TDX 真的回得了資料」是另一件事，手動跑一次就好。

**也不測 UI**：版面、骨架對不對、按鈕接到哪，都要真的開瀏覽器走一遍。

## 5. 踩過的坑

- 冷快取時查一個縣市的公車站牌要 10 個請求，一定會撞到每分鐘 5 次的額度——所以
  `bus-routing.ts` 不是「全查一遍再排序」。
- Mongo 快取這層在 serverless 冷啟動後還在，記憶體快取不在。只做記憶體快取形同沒快取。
