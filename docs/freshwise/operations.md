# 菜鳥買菜記（freshwise）— 運維手冊

> **這份是寫給「沒有 AI 可用、網站又出問題」的那一天的。** 不講程式怎麼寫（那在
> [rules.md](rules.md)），只講：要跑起來需要什麼、資料庫裡有什麼、壞了怎麼自己查、
> 哪些東西在版控裡、哪些不在。
>
> 2026-11-28 建立。這個工具完成度最高，所以先寫它；其他工具之後照這個形狀補。

---

## 1. 跑起來需要什麼

| 項目 | 值 | 沒有會怎樣 |
| --- | --- | --- |
| Node | 22.x（開發機實測 22.14） | — |
| `MONGODB_URI` | MongoDB 連線字串，放 `.env.local`（**不在版控裡**） | 開頁面就 500，訊息是「缺少 MONGODB_URI 環境變數」 |
| 資料庫名稱 | `Tools`（寫死在 `lib/mongodb.ts`） | — |
| 外部 API | 農業部開放資料，**免金鑰、免註冊** | 抓不到就顯示舊快照；完全沒資料時畫面會說「這個場所目前還沒有行情」 |

這個工具**不需要任何 API key**——農業部那幾支開放資料是公開端點。需要金鑰的是搭乘車
（`TDX_CLIENT_ID` / `TDX_CLIENT_SECRET` / `CWA_API_KEY`），跟這個工具無關。

```bash
npm install
npm run dev        # http://localhost:3000/tools/freshwise
```

進得去還要兩個條件：**有登入**，而且那個帳號的 `tools` 陣列裡有 `freshwise`
（沒有的話會看到「沒有權限」畫面，不是 404）。開權限的方法見第 4 節。

---

## 2. 資料庫規格

資料庫 `Tools`，這個工具用七個 collection，另外三個是全站共用的。

### 這個工具自己的

| collection | `_id` 的形狀 | 裡面是什麼 | 誰寫 | 掉了會怎樣 |
| --- | --- | --- | --- | --- |
| `freshwise.snapshots` | `${場所}:${日期}`<br>例 `market:2026-11-28` | 那一天那個場所**整份目錄**的行情（`byCode`：品項代碼 → 價格、來源、各市場明細） | `prices.server.ts` 的同步 | **可重建**：下次開頁面會重抓今天的；歷史要跑 sync 補 |
| `freshwise.series` | `${場所}:${品項代碼}`<br>例 `market:FA1` | 這個品項的走勢（`points`：`[日期, 元/公斤]` 遞增）＋ 一年統計 | 同上 | **可重建但很慢**（要一天一天重抓）。掉了的話「比平常便宜 X%」會退回「歷史資料累積中」 |
| `freshwise.traced` | 日期 | 有標章 vs 一般的批發價比較 | 同上 | 可重建；詳情頁少一塊比較 |
| `freshwise.sourceCache` | 來源端點 | 農業部原始回應的快取，**有 TTL 會自己過期** | 同上 | 無所謂，重抓就好 |
| `freshwise.syncMarkers` | 標記名稱 | 「這一段歷史已經補過了」的註記，避免重複補 | 同上 | 刪掉只會讓它再補一次（慢，不會壞） |
| `freshwise.userData` | **使用者 id** | 這個人的偏好（場所／單位／市場）＋ 菜籃（分類與項目） | 使用者操作 | **不可重建**，是使用者資料 |
| `freshwise.companions` | **使用者 id** | 夥伴養成進度（露珠、印章、成長、外觀、今日任務） | 使用者操作 | **不可重建**，是使用者資料 |

> 分界線很清楚：**前五個是行情快取，刪掉只是慢，不會掉東西；後兩個是使用者資料，刪了就沒了。**
> 要清東西時先確認自己在刪哪一邊。

### 全站共用的

| collection | 用途 |
| --- | --- |
| `users` | 帳號（`username` 唯一索引、bcrypt 密碼雜湊、`tools` 權限陣列、`isAdmin`） |
| `sessions` | 登入 session，**TTL 索引到期自動刪** |
| `toolsRegistry` | 工具清單。由 `lib/tools-registry.ts` 在啟動時 upsert 進來，不用手動維護 |

### 索引

`lib/mongodb.ts` 的 `ensureIndexes()` 在第一次連線時自動建，不用手動下。

| collection | 索引 | 為什麼 |
| --- | --- | --- |
| `freshwise.sourceCache` | `expiresAt` TTL | 過期的快取自己消失，不用寫清理排程 |
| `freshwise.snapshots` | `{ venue: 1, date: -1 }` | 查詢一律是「某場所、某日期之前最近的一筆」 |
| `freshwise.series` | `{ updatedAt: -1 }` | 看「資料多久沒更新」 |
| `users` | `username` unique | 擋重複註冊 |
| `sessions` | `expiresAt` TTL | 過期 session 自動清 |

`userData` 與 `companions` **沒有額外索引**——一人一份文件、直接用 `_id` 查。

---

## 3. 資料怎麼來的

```
農業部開放資料（免金鑰）
        │  ①  使用者開頁面時自動抓「最近幾天」      ← 正常情況只靠這個
        │  ②  npm run sync:freshwise（暖機／排程）  ← 補歷史用
        ▼
freshwise.sourceCache（原始回應，TTL 自動過期）
        ▼  整理
freshwise.snapshots（每天每場所一份）→ freshwise.series（走勢）
        ▼
頁面（Server Component 讀好 PriceBook 傳給畫面）
```

**正常使用不需要跑 sync**：頁面算繪時的 `ensureFresh` 會確保最近幾天是新的。sync 是給兩種
情況用的——第一次上線的暖機（批發歷史要一天一天補，門檻 30 天才講得出「比平常便宜」）、
或掛成每天的 cron（農業部大約上午公布，排 11:00 之後）。

```bash
npm run sync:freshwise                        # 今天的（零售一年＋產地價＋批發最近 8 天）
npx tsx scripts/freshwise-sync.mts --days 60  # 另外往回補 60 天批發歷史
```

**目前沒有掛任何排程**（專案裡沒有 `vercel.json` 的 cron 設定）——是手動跑的。

---

## 4. 人工維護：遇到什麼做什麼

### 新帳號看不到這個工具

既有帳號不會自動拿到新工具的權限（`createUser` 只在**註冊當下**抓一次工具清單）。

- **從畫面**：用管理員帳號進 `/admin`，找到那個使用者，把 `freshwise` 勾起來。
- **直接改資料庫**：
  ```js
  db.users.updateOne({ username: "xxx" }, { $addToSet: { tools: "freshwise" } })
  ```

### 價格沒更新／顯示的是前幾天的資料

照順序查：

1. **是不是休市？** 批發市場週一整天沒有資料，畫面會標「目前顯示的是 11/27 的資料」——
   那是**正常行為**，不是壞掉。
2. **農業部那邊有沒有資料？** 直接用瀏覽器打開端點看（免金鑰），端點與參數坑寫在
   `lib/freshwise/moa-client.ts` 的檔頭（`StartDate` 必填、民國年有兩種格式）。
3. **快照有沒有進來？**
   ```js
   db["freshwise.snapshots"].find({}, { date: 1, venue: 1 }).sort({ date: -1 }).limit(5)
   ```
4. 都正常就手動跑一次 `npm run sync:freshwise`，看它印什麼。

### 想把行情資料整個重來

只會慢，不會掉使用者資料：

```js
db["freshwise.sourceCache"].drop()
db["freshwise.snapshots"].drop()
db["freshwise.series"].drop()
db["freshwise.traced"].drop()
db["freshwise.syncMarkers"].drop()
```
然後 `npx tsx scripts/freshwise-sync.mts --days 60` 補回來。**不要碰 `userData` 與
`companions`**，那兩個是使用者的。

### 某個使用者的菜籃／夥伴要重置

畫面上有：設定頁的「清除資料」可以分別清夥伴與菜籃。真要從資料庫來：

```js
db["freshwise.userData"].deleteOne({ _id: "<使用者 id>" })
db["freshwise.companions"].deleteOne({ _id: "<使用者 id>" })
```
刪掉之後下次進頁面會重建成預設狀態（預設菜籃、糰糰、露珠 0）。

### 圖片破圖或整排留白

網頁用圖全部在 `public/freshwise/`（595 張 WebP），**母圖不在專案裡**，在
`小工具素材/圖片未壓縮/freshwise/`。重建：

```bash
npx tsx scripts/freshwise-build-web-images.mts --dry   # 先看會做什麼
npx tsx scripts/freshwise-build-web-images.mts         # 從母圖重建全部
```

要先知道是哪一種壞：
```bash
npm run check:freshwise      # 裡面有「素材路徑真的存在」一段，會指出缺哪一張
```
**整排品項變留白**通常不是缺圖，是 `components/freshwise/item-icon.tsx` 的
`ITEM_CODE` 正規表示式跟 `itemImage()` 產生的副檔名對不上（見 rules.md）。

### 活動序號兌換不了

序號與露珠數量由伺服器核對（`lib/freshwise/companions.server.ts`）。驗一次：

```bash
npx tsx scripts/freshwise-activity-code-check.mts    # 要 .env.local
```

---

## 5. 版控範圍：什麼進 git、什麼不進

### 進版控

| 範圍 | 說明 |
| --- | --- |
| `app/`、`components/`、`lib/`、`scripts/` | 所有程式碼與檢查腳本 |
| `public/freshwise/*.webp` | **595 張網頁用圖會進版控**（約 11MB）。它們是建置產物，但部署要用，而且重建需要素材庫（不在這台機器上也可能跑不了） |
| `public/freshwise/README.md` | 那個資料夾的規則 |
| `docs/` | 五個工具的 rules／design／status／history（＋這份） |
| `CLAUDE.md`、`AGENTS.md`、`package.json`、設定檔 | — |

### 不進版控（`.gitignore`）

| 範圍 | 為什麼 |
| --- | --- |
| `.env.local` | **有 MongoDB 連線字串與其他工具的金鑰。外洩等於資料庫被拿走。** |
| `node_modules/`、`.next/`、`.vercel/`、`*.tsbuildinfo` | 建置產物 |
| `scripts/.*-report.txt`、`scripts/.inventory.txt`、`scripts/.freshwise-web-images.txt` | 檢查與建置的報告，每次跑都會重寫 |
| `public/**/*.zip`、`public/freshwise/unused/` | 素材暫存 |
| `UIUX示意設計稿/`、`gamebundle設計參考風格/` | 設計稿與第三方參考素材（16MB 起跳） |

### 完全不在專案裡（在 `D:\coding-project\小工具素材\`）

| 位置 | 內容 |
| --- | --- |
| `圖片未壓縮/freshwise/` | **595 張母圖**（PNG，約 196MB）＋ `網頁素材對照.csv`（每張的尺寸、來源、SHA-256） |
| `菜鳥買菜記/素材生成批次紀錄.md` | 素材是怎麼生成出來的（提示詞、每一批做了什麼） |
| `菜鳥買菜記/食材圖/ingredient-art-inventory.csv` | 哪個農業部品項對應哪張圖 |
| `菜鳥買菜記/freshwise-other-pet-growth-v1/` | 夥伴的完整素材包（126 張 PNG 母圖、各階段對照表） |

> **這些沒有備份在 git 裡。** 硬碟掛了就沒了——母圖重畫不回來，網頁用圖只剩版控裡那份
> 壓縮過的 WebP。要備份的話，優先備這個資料夾。

---

## 6. 部署

Vercel（`.vercel/` 在本機、不進版控）。要注意的三件事：

1. **時區是 UTC。** 所以「今天」一律走 `lib/freshwise/dates.ts` 的 `todayISO()`（`Asia/Taipei`）
   ——直接用 `new Date()` 的話台灣凌晨 0～8 點整個工具會顯示昨天。
2. **環境變數要在 Vercel 的專案設定裡另外填一次**，`.env.local` 不會上去。
3. **`next build` 時不會連資料庫**（`lib/mongodb.ts` 刻意不在模組頂層連線），所以 build
   環境沒有 `MONGODB_URI` 也建得起來——但跑起來就會 500。

---

## 7. 壞掉時的判斷順序

```
整頁 500
 ├─ 訊息提到 MONGODB_URI        → .env.local 沒設 / Vercel 環境變數沒填
 ├─ 訊息提到 toLocaleString of null → Mongo 把 undefined 存成 null，看 rules.md 的「踩過的坑」
 └─ 其他                        → 看 Vercel 的 Function Logs

畫面出得來但沒有價格
 ├─ 寫「目前顯示的是 X 月 X 日的資料」 → 正常（休市或來源還沒更新）
 ├─ 寫「這個場所目前還沒有行情」      → 資料庫是空的，跑 sync
 └─ 只有某幾樣沒有                   → 那幾樣今天沒成交，是正常的

圖片壞掉
 ├─ 整排留白        → item-icon.tsx 的正規表示式與副檔名對不上
 └─ 單張破圖        → npm run check:freshwise 看「素材路徑真的存在」那段

數字怪怪的
 └─ 先跑 npm run check:freshwise（289 項純函式）——它不需要資料庫，
    通過就代表算法沒壞，問題在資料
```
