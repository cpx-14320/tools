# 搭乘車查詢（transit）— 已完成紀錄

> 2026-11-27 建立。**這個工具以前沒有獨立文件**，所以沒有歷史紀錄可以搬過來——
> 2026-11-27 之前的決策只留在程式碼的檔頭註解裡（那些註解寫得很完整，
> [rules.md](rules.md) 就是從它們整理出來的）。
>
> 往後每做完一輪，照另外兩個工具的格式往下疊：一節一輪，寫「做了什麼 ＋ 為什麼這樣決定」，
> 不要改舊的紀錄。規則變了就同步改 [rules.md](rules.md)，待辦記在 [status.md](status.md)。

## 現有的決策紀錄在哪

| 主題 | 在哪個檔案的檔頭 |
| --- | --- |
| 三層快取與 TTL 分級 | `lib/transit/tdx-client.ts`、`lib/transit/api-cache.ts` |
| 金鑰為什麼不能進 client bundle | `lib/transit/tdx-client.ts`、`cwa-client.ts`、`train-cities-client.ts` |
| 捷運站序為什麼寫死、key 為什麼用系統名稱 | `lib/transit/metro-lines.ts` |
| 台鐵「臺」與高鐵「台」的字形差異 | `lib/transit/tdx-stations.ts` |
| CWA 鄉鎮預報每個縣市是獨立 dataset | `lib/transit/cwa-districts.ts` |
| 公車／YouBike 的縣市代碼為什麼兩份 | `lib/transit/bus-routing.ts`、`ubike.ts` |
| 色票、字級、間距、文案用詞 | [design.md](design.md)（224 行，2026-11-28 從 `components/transit/DESIGN-SYSTEM.md` 搬來） |

---

## 2026-11-27：補上回歸測試腳本（`npm run check:transit`）

這個工具原本是五個裡唯一**有伺服器邏輯卻沒有任何測試**的。新增
`scripts/transit-feature-check.mts`，**76 項**，不用資料庫、不用 `.env.local`、不打 TDX。

### 為什麼重點是「兩份清單要對得起來」，不是演算法

這個工具最容易壞的地方不是轉乘計算，是**同一件事寫在兩個檔案裡**：

| 畫面那一份 | 伺服器那一份 | 少一邊會怎樣 |
| --- | --- | --- |
| `components/transit/bus-cities.ts` 的中文縣市名 | `lib/transit/bus-routing.ts` 的 `BUS_CITY_CODE` | 使用者選得到那個縣市，查詢靜靜地回空清單 |
| `components/transit/ubike-cities.ts` | `lib/transit/ubike.ts` 的 `UBIKE_CITY_CODE` | 同上 |
| `METRO_TRANSFER_HUBS` 的站點字串 | `METRO_STATIONS_BY_CITY` 的站點清單 | 打錯一個字（多一個「站」、少一個站碼）那個轉乘從此找不到 |
| `DISTRICTS_BY_CITY` 的縣市 | `DISTRICT_DATASET_ID` | 那個縣市的鄉鎮天氣查不到 |

**這幾種錯都不會有錯誤訊息**，所以腳本把它們排在最前面。

### 六段

時間工具（跨午夜、帶秒數的 `HH:mm:ss`）／距離計算／公車與 YouBike 縣市清單／捷運站點與
轉乘圖（站碼格式、`metroSystemOf`、跨系統轉乘雙向）／高鐵站名（台↔臺 兩種寫法同一站號）／
天氣鄉鎮對照（22 縣市 368 區）／API 快取分級（都是 `private`、層級順序、不比伺服器端久）。

### 刻意不測的

- **不打 TDX。** 每分鐘 5 次的額度禁不起 CI 跑兩次，外部資料每天在變、測試會莫名其妙地紅。
  所以 `computeMetroTrip`（要 TDX 的站間行車時間）與公車搜尋不在範圍內。要測它們得先把
  「建圖」與「取資料」拆開，讓前者吃假資料——記在 status.md。
- **不測 UI。** 骨架與版面對不對只能開瀏覽器看。

### 寫測試時被測試自己抓到的一件事

原本斷言「台北捷運 → 桃園機場捷運 的轉乘站是三重、換乘線代碼是 A」，實際回的是**台北車站**
——`findCrossSystemTransferStation` 取的是 `METRO_TRANSFER_HUBS` 裡第一個同時涵蓋兩個系統的
hub，而台北車站排在三重前面。程式沒錯，是斷言寫死了順序。改成驗「回傳的線代碼真的屬於目的
系統在那個 hub 底下的某一站」，不綁清單順序。

## 2026-11-28：設計系統文件搬進 docs，色票依工具分家

`components/transit/DESIGN-SYSTEM.md` → `docs/transit/design.md`，跟 rules／status／history
放在一起。另外三個工具也各有一份（記帳本與入口那兩份是這次從 `theme.ts`、`globals.css`
整理出來的，以前沒有文件）。

為什麼不把色票塞進 `rules.md`：**色票是依工具分家的**（四套 token 互不相同），而且只有真的
要動樣式時才需要讀。做邏輯改動的人不該為了查一條資料規則，順便讀完一百多行的色票表。
