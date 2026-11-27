# docs — 四個工具的規則、現況與紀錄

這個資料夾解決一件事：**要查規則的時候，不用讀完整部歷史。**

以前每個工具只有一份 `<工具>-directions.md`，規則與歷史混在裡面（菜鳥買菜記那份長到 2900
行）。現在每個工具固定三份：

| 檔案 | 內容 | 什麼時候讀 | 多長 |
| --- | --- | --- | --- |
| `rules.md` | 規則 ＋ 執行規範 ＋ 怎麼驗 | **動這個工具之前先讀這份** | 幾百行，會改但不會無限長 |
| `design.md` | 色票、字級、間距、版面 | **改這個工具的任何顏色／字級／間距之前** | 一兩百行 |
| `status.md` | 待確認 ＋ 未處理 | 要挑下一件事做的時候 | 一頁以內 |
| `history.md` | 已完成的決策紀錄 | 只有在 `rules.md` 回答不了「為什麼當初這樣決定」時才翻 | 只增不減 |

`design.md` 單獨一份而不是塞進 `rules.md`：**色票是依工具分家的**（三個工具三套 `theme.ts`，
色碼互不相同），而且只有在真的要動樣式時才需要讀。做邏輯改動的人不該為了查一條資料規則，
順便讀完一百多行的色票表。

分三份而不是五份的理由：**規則**與**執行規範**的界線本來就模糊（「色票統一在 theme.ts」
算哪一種？），分開放的結果是每次都得讀兩份；**待確認**與**未處理**都是待辦，差別只在一個
欄位，分開看反而容易漏掉「待確認的那件事其實卡住了未處理的那件」。**已完成**一定要單獨一份
——它是唯一會無限長大的那一份，也正是以前要查規則卻得翻 2900 行的原因。

## 四個工具

| 工具 | 程式 | 文件 |
| --- | --- | --- |
| 菜鳥買菜記（freshwise）🟩 | `*/freshwise` | [rules](freshwise/rules.md) · [design](freshwise/design.md) · [status](freshwise/status.md) · [history](freshwise/history.md) |
| 記帳本（expenses）🟪 | `*/expenses` | [rules](expenses/rules.md) · [design](expenses/design.md) · [status](expenses/status.md) · [history](expenses/history.md) |
| 搭乘車查詢（transit）🟪 | `*/transit` | [rules](transit/rules.md) · [design](transit/design.md) · [status](transit/status.md) · [history](transit/history.md) |
| 圖片壓縮（compress） | `app/tools/compress`、`lib/compress` | [rules](compress/rules.md) · [design](compress/design.md) · [status](compress/status.md) · [history](compress/history.md) |
| 入口與帳號（hub） | `app/page.tsx`、`app/login`、`app/register`、`app/admin`、`components/ui.tsx` | [rules](hub/rules.md) · [design](hub/design.md) · [status](hub/status.md) · [history](hub/history.md) |

工具清單本身在 `lib/tools-registry.ts`（新增工具時 `lib/mongodb.ts` 的 `toolsRegistry`
seed 要一起加）。

## 跨工具的共通規則

這幾條對五個工具都成立，所以只寫在這裡，各工具的 `rules.md` 不重複：

1. **四套設計系統不互相 import。** 色票是**依工具分家**的，各自一份 `design.md`：

   | 工具 | token 在哪 | 設計文件 |
   | --- | --- | --- |
   | 菜鳥買菜記（綠） | `components/freshwise/theme.ts` | [freshwise/design.md](freshwise/design.md) |
   | 記帳本（紫） | `components/expenses/theme.ts` | [expenses/design.md](expenses/design.md) |
   | 搭乘車（紫） | `components/transit/theme.ts` | [transit/design.md](transit/design.md) |
   | 入口／登入／後台／圖片壓縮 | `app/globals.css` 的 `:root` ＋ `components/ui.tsx` | [hub/design.md](hub/design.md) |

   記帳本與搭乘車的紫看起來很像但不是同一組，三者的 `ink`／`muted` 也不是同一個顏色。
   混用的結果是「看起來幾乎一樣但就是哪裡怪」。**改樣式前只讀你要動的那個工具那一份。**
2. **畫面上不要出現 token 以外的新數字、新顏色、新字級。** 需要一個現在沒有的樣式時，
   先問「是不是既有 token 的某一階」，真的沒有才在那個工具的 `theme.ts` 加一階並寫理由。
3. **API 金鑰只能活在 `app/api/**` 與 `*.server.ts`。** 帶金鑰的模組（TDX、CWA、mongodb）
   絕對不能被 `"use client"` 的檔案 import，否則會被打包進前端 bundle。要在瀏覽器端用到
   同一份資料時，另外寫一個不碰金鑰的 client 版（例：`lib/transit/train-cities-client.ts`）。
4. **資料存在帳號底下，不是瀏覽器底下。** 換裝置、清快取都不該掉資料。localStorage 只用在
   「這台裝置的偏好」這種掉了也沒差的東西。
5. **文字一律由 HTML 呈現，不烘進圖片。** 價格、日期、等級、進度、標題、按鈕文字都是。
6. 回覆與文件一律用中文（含標題與小結），不要中英混用的標籤。

## 怎麼驗（六支腳本）

| 指令 | 驗什麼 | 要不要資料庫 |
| --- | --- | --- |
| `npm run check:freshwise` | 菜鳥買菜記的純函式：假價格可重現、單位換算、漲跌與划算度、搜尋排序、菜籃增刪改、素材路徑真的存在（289 項） | 不用 |
| `npx tsx scripts/freshwise-companion-check.mts` | 養成與素材核心：任務／露珠／成長、三階段圖檔、外觀選擇（26 組） | 不用 |
| `npx tsx scripts/freshwise-user-data-check.mts` | 菜籃與偏好的伺服器端讀寫 | **要**（`.env.local`） |
| `npx tsx scripts/freshwise-activity-code-check.mts` | 活動序號兌換 | **要** |
| `npm run check:transit` | 搭乘車的純函式與靜態資料：時間與距離、公車／YouBike 縣市代碼對照、捷運站點與轉乘圖、高鐵站名、天氣鄉鎮對照、API 快取分級（76 項，**不打 TDX**） | 不用 |
| `npm run check:expenses` | 記帳本的業務邏輯：建立真測試帳號跑過分類／帳戶／交易／轉帳／預算／目標／固定收支／垃圾桶／批次／CSV／AI 草稿／養成／偏好（120 項），跑完自己清乾淨 | **要** |

另外三支是工具不是測試：`freshwise-sync.mts`（抓農業部行情寫進 Mongo）、
`freshwise-build-web-images.mts`（母圖 → 網頁用圖）、`freshwise-missing-art.mts`（列出缺圖）、
`expenses-account-inventory.mts` / `expenses-dedupe-presets.mts` / `expenses-repack-order.mts`
（記帳本的一次性維護腳本）。

搭乘車刻意不把「會打 TDX 的部分」寫進測試：那個帳號每分鐘只有 5 次額度，CI 跑兩次就用光，
而且外部資料每天在變、測試會莫名其妙地紅。

**沒有腳本測 UI。** 按鈕有沒有接對、版面好不好用、文案講不講得清楚，一律要真的開瀏覽器
走一遍。所以每個工具的 `status.md` 裡會有 UI 層的待處理項目——那些是腳本抓不到的。

跑完一輪改動的標準順序：

```
npx tsc --noEmit            # 型別
npx eslint app components lib scripts
npm run check:freshwise     # 或 check:expenses / check:transit，看動到哪個工具
```
