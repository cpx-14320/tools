# docs — 五個工具的規則、現況與紀錄

這個資料夾解決一件事：**要查規則的時候，不用讀完整部歷史。**

以前每個工具只有一份 `<工具>-directions.md`，規則與歷史混在裡面（菜鳥買菜記那份長到 2900
行）。現在每個工具固定三份：

| 檔案 | 內容 | 什麼時候讀 | 多長 |
| --- | --- | --- | --- |
| `rules.md` | 規則 ＋ 執行規範 ＋ 怎麼驗 | **動這個工具之前先讀這份** | 幾百行，會改但不會無限長 |
| `design.md` | 色票、字級、間距、版面 | **改這個工具的任何顏色／字級／間距之前** | 一兩百行 |
| `status.md` | 待確認 ＋ 未處理 | 要挑下一件事做的時候 | 一頁以內 |
| `history.md` | 已完成的決策紀錄 | 只有在 `rules.md` 回答不了「為什麼當初這樣決定」時才翻 | 只增不減 |
| `operations.md` | 資料庫規格、人工維護、版控範圍、壞掉時怎麼查 | **沒有 AI 可用、網站又出問題**的時候 | 一兩百行 |

`operations.md` 目前**只有菜鳥買菜記有**（它完成度最高）。其他工具之後照同一個形狀補：
跑起來需要什麼 → 資料庫規格 → 資料怎麼來 → 遇到什麼做什麼 → 版控範圍 → 部署 → 判斷順序。

### 什麼可以重複寫、什麼不行

只有**會變的東西**不能重複：數字（檢查項數、色碼、尺寸）、清單（有哪些工具、有哪些腳本）、
路徑。那種內容寫在兩個地方，遲早有一邊沒跟上，而且讀的人不知道該信哪一個。所以它們各自只有
一個家：色碼在 `design.md`、檢查項數在這份的腳本總表、工具清單在 `lib/tools-registry.ts`。

**不會變的原則可以重複一句**（「不測 UI」「只有手機版版面」「金鑰不能進 client bundle」）
——它在用得到的地方出現一次，省掉一次跳轉，而且它不會過期。

`design.md` 單獨一份而不是塞進 `rules.md`：**色票是依工具分家的**（三個工具三套 `theme.ts`，
色碼互不相同），而且只有在真的要動樣式時才需要讀。做邏輯改動的人不該為了查一條資料規則，
順便讀完一百多行的色票表。

分三份而不是五份的理由：**規則**與**執行規範**的界線本來就模糊（「色票統一在 theme.ts」
算哪一種？），分開放的結果是每次都得讀兩份；**待確認**與**未處理**都是待辦，差別只在一個
欄位，分開看反而容易漏掉「待確認的那件事其實卡住了未處理的那件」。**已完成**一定要單獨一份
——它是唯一會無限長大的那一份，也正是以前要查規則卻得翻 2900 行的原因。

## 六個工具

| 工具 | 程式 | 文件 |
| --- | --- | --- |
| 菜鳥買菜記（freshwise）🟩 | `*/freshwise` | [rules](freshwise/rules.md) · [design](freshwise/design.md) · [status](freshwise/status.md) · [history](freshwise/history.md) · [operations](freshwise/operations.md) |
| 記帳本（expenses）🟪 | `*/expenses` | [rules](expenses/rules.md) · [design](expenses/design.md) · [status](expenses/status.md) · [history](expenses/history.md) |
| 搭乘車查詢（transit）🟪 | `*/transit` | [rules](transit/rules.md) · [design](transit/design.md) · [status](transit/status.md) · [history](transit/history.md) |
| 聚會遊戲室（gamebundle）🟦 | `app/party`、`app/display`、`*/gamebundle` | [rules](gamebundle/rules.md) · [design](gamebundle/design.md) · [status](gamebundle/status.md) · [history](gamebundle/history.md) |
| 圖片壓縮（compress） | `app/tools/compress`、`lib/compress` | [rules](compress/rules.md) · [design](compress/design.md) · [status](compress/status.md) · [history](compress/history.md) |
| 入口與帳號（hub） | `app/page.tsx`、`app/login`、`app/register`、`app/admin`、`components/ui.tsx` | [rules](hub/rules.md) · [design](hub/design.md) · [status](hub/status.md) · [history](hub/history.md) |

工具清單本身在 `lib/tools-registry.ts`，那是**唯一來源**——`lib/mongodb.ts` 直接把它
upsert 進 `toolsRegistry` 集合，不是另外維護一份。

## 跨工具的共通規則

這幾條對五個工具都成立，所以只寫在這裡，各工具的 `rules.md` 不重複：

1. **五套設計系統不互相 import。** 色票是**依工具分家**的，各自一份 `design.md`：

   | 工具 | token 在哪 | 設計文件 |
   | --- | --- | --- |
   | 菜鳥買菜記（綠） | `components/freshwise/theme.ts` | [freshwise/design.md](freshwise/design.md) |
   | 記帳本（紫） | `components/expenses/theme.ts` | [expenses/design.md](expenses/design.md) |
   | 搭乘車（紫） | `components/transit/theme.ts` | [transit/design.md](transit/design.md) |
   | 聚會遊戲室（藍，**唯一深色底**） | `components/gamebundle/theme.ts` | [gamebundle/design.md](gamebundle/design.md) |
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
7. **做新小工具時，回歸測試腳本要一起做**，不是「之後有空再補」——見下面的新增工具檢查清單。

## 怎麼驗（七支腳本）

**項數只記在這張表**——各工具的 `rules.md` 只寫「跑什麼指令、涵蓋與不涵蓋什麼」，不寫數字。
數字會隨著每次補測試變動，寫在兩個地方就一定會有一邊忘了改。

| 指令 | 驗什麼 | 要不要資料庫 |
| --- | --- | --- |
| `npm run check:freshwise` | 菜鳥買菜記的純函式：假價格可重現、單位換算、漲跌與划算度、搜尋排序、菜籃增刪改、素材路徑真的存在（289 項） | 不用 |
| `npx tsx scripts/freshwise-companion-check.mts` | 養成與素材核心：任務／露珠／成長、三階段圖檔、外觀選擇（27 組） | 不用 |
| `npx tsx scripts/freshwise-user-data-check.mts` | 菜籃與偏好的伺服器端讀寫 | **要**（`.env.local`） |
| `npx tsx scripts/freshwise-activity-code-check.mts` | 活動序號兌換 | **要** |
| `npm run check:transit` | 搭乘車的純函式與靜態資料：時間與距離、公車／YouBike 縣市代碼對照、捷運站點與轉乘圖、高鐵站名、天氣鄉鎮對照、API 快取分級（76 項，**不打 TDX**） | 不用 |
| `npm run check:gamebundle` | 聚會遊戲室的純函式與素材清冊：入口管制九種組合、房間代碼與輸入驗證、分組與開局檢查、計分與速度加成、生命與淘汰、狀態機、猜拳、抽獎資格與抽樣、題庫驗證與快照、倒數校正、遊戲目錄、素材清冊（215 項） | 不用 |
| `npm run check:expenses` | 記帳本的業務邏輯：建立真測試帳號跑過分類／帳戶／交易／轉帳／預算／目標／固定收支／垃圾桶／批次／CSV／AI 草稿／養成／偏好（120 項），跑完自己清乾淨 | **要** |

另外三支是工具不是測試：`freshwise-sync.mts`（抓農業部行情寫進 Mongo）、
`freshwise-build-web-images.mts`（母圖 → 網頁用圖）、`freshwise-missing-art.mts`（列出缺圖）、
`expenses-account-inventory.mts` / `expenses-dedupe-presets.mts` / `expenses-repack-order.mts`
（記帳本的一次性維護腳本）。

搭乘車刻意不把「會打 TDX 的部分」寫進測試：那個帳號每分鐘只有 5 次額度，CI 跑兩次就用光，
而且外部資料每天在變、測試會莫名其妙地紅。

## 新增一個小工具時，要一起做的事

少做任何一項，那個工具就會變成「只有作者知道怎麼回事」的狀態——搭乘車就是這樣過了好幾個月
（程式寫得很完整、檔頭註解也很用心，但沒有文件也沒有測試，要改之前得先把 16 個檔案讀一遍）。

| # | 要做的 | 怎麼做 |
| --- | --- | --- |
| 1 | 註冊到工具清單 | 只改 `lib/tools-registry.ts`（`lib/mongodb.ts` 會把它 upsert 進資料庫）。**既有帳號不會自動拿到權限**，要去 `/admin` 勾；新註冊的帳號才會自動有 |
| 2 | 權限閘門 | `app/tools/<id>/layout.tsx` 擋沒權限的人，API route 一律 `requireTool("<id>")` |
| 3 | 刪帳號要清得到 | `lib/admin.ts` 的 `deleteUserCascade` 加上這個工具的 collection——畫面上寫著「各工具底下的資料也會一併刪除」，就要真的做到 |
| 4 | 四份文件 | `docs/<tool>/` 的 `rules.md`／`design.md`／`status.md`／`history.md`。沒有歷史就誠實寫「還沒有，以後往下疊」，不要編 |
| 5 | **回歸測試腳本** | 見下面 |

### 回歸測試腳本跟功能一起做，不是之後再補

**「之後有空再補」等於不會補。** 而且越晚寫越難寫——等到程式已經把「算邏輯」與「打 API／
查資料庫」黏在一起，就得先重構才測得了（搭乘車的捷運轉乘演算法現在就卡在這裡，見
[transit/status.md](transit/status.md)）。

照這個形狀做，三支現有的腳本都長一樣：

| 項目 | 慣例 |
| --- | --- |
| 檔名 | `scripts/<tool>-feature-check.mts` |
| 指令 | `package.json` 加 `"check:<tool>": "tsx scripts/<tool>-feature-check.mts"` |
| 報告 | 寫到 `scripts/.<tool>-check-report.txt`（`.gitignore` 已經有 `scripts/.*-report.txt`） |
| 結束碼 | 全過 0、有失敗 1（才接得上 CI 或 pre-push） |
| 骨架 | 照抄既有那三支的 `log`／`section`／`check`／`run`，**區塊丟例外不中斷整支**，記成一項失敗繼續跑下一段 |

**先測什麼**，依這個順序：

1. **純函式與靜態資料**——算得對不對、兩份清單對不對得起來。不用資料庫、不用網路，跑兩秒。
   這一層的投報率最高，搭乘車那一支整支都屬於這一類。
2. **「同一件事寫在兩個檔案裡」的對照**——畫面的中文名 vs 伺服器的代碼、資料表 vs 對照表。
   這種錯**不會有任何錯誤訊息**，只會靜靜地查不到東西，所以最該自動驗。
3. **伺服器端的業務邏輯**（要資料庫）——建一個真的測試帳號跑一輪，`finally` 裡清乾淨，
   照 `expenses-feature-check.mts` 的做法。
4. **素材路徑真的存在**——如果這個工具有圖。少一張圖不會報錯，只會變成破圖或一整排留白。

**不要測的**：會打外部 API 的部分（額度與不穩定的資料會讓測試莫名其妙地紅）、UI（版面、
按鈕接到哪、文案清不清楚只能人工走）。

**測試裡不要寫死會變的數字。** 獎勵、成本、門檻這些一律從常數讀——調一個常數卻紅了七條
測試，那種失敗沒有資訊量，只會讓人習慣性地改測試而不是看功能。

### 什麼時候該加一條檢查

三種情況，都來自真實事件：**定下一條新規則**（補一條守住它）、**踩到一個坑**（補一條讓它
不會再發生）、**有人問「會不會…」**（查完把答案變成測試）。不要為了湊數量而寫。

**沒有腳本測 UI。** 按鈕有沒有接對、版面好不好用、文案講不講得清楚，一律要真的開瀏覽器
走一遍。所以每個工具的 `status.md` 裡會有 UI 層的待處理項目——那些是腳本抓不到的。

跑完一輪改動的標準順序：

```
npx tsc --noEmit            # 型別
npx eslint app components lib scripts
npm run check:freshwise     # 或 check:expenses / check:transit，看動到哪個工具
```
