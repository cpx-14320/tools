# 搭乘車查詢 — 設計系統

這份文件是「搭乘車」工具（`app/tools/transit/**`、`components/transit/**`）的唯一樣式依據。
程式裡對應的實作是兩個檔案：

| 檔案 | 內容 |
| --- | --- |
| `components/transit/theme.ts` | 色票、字級、間距、圓角、陰影、文案用詞的 token |
| `components/transit/ui.tsx` | 共用元件（文字、按鈕、輸入、容器、分頁、徽章、拖曳握把） |

規則只有一條：**畫面上不要再出現 token 以外的新數字、新顏色、新字級。** 需要一個現在沒有的
樣式時，先問「是不是既有 token 的某一階」，真的沒有才在 `theme.ts` 加一階並寫下理由。

> 這套只給搭乘車用。記帳本有自己的 `components/expenses/theme.ts`，登入／註冊／管理後台走
> `components/ui.tsx` ＋ `globals.css` 那套舊色票。三者的 ink／muted 根本不是同一個顏色，
> 不要互相 import。

---

## 1. 色票

| token | 色碼 | 用途 |
| --- | --- | --- |
| `ink` | `#4A3B7C` | 主要文字、標題、欄位值 |
| `muted` | `#9C94C4` | 次要說明文字、欄位小標 |
| `faint` | `#B3ABD4` | 空狀態、載入中、列表附註 |
| `placeholder` | `#C7BFE6` | 還沒填的值、裝飾性箭頭 |
| `border` | `#ECE4FA` | 輸入框／下拉選單邊框、彈窗標題列分隔線 |
| `borderSoft` | `#F2EEFA` | 卡片內部的淡分隔線 |
| `surfaceSoft` | `#F3EFFC` | pill 選單底、hover 底、列尾小按鈕底 |
| `surfaceActive` | `#EFEAFC` | 選中態底色 |
| `surfaceHover` | `#F8F6FD` | 清單列 hover |
| `brand` / `brandLight` | `#6F5FD6` / `#8A7CEE` | 品牌紫（主要按鈕漸層的兩端） |
| `skeleton` | `#E4DBF9` | 骨架色塊 |
| `positive` / `positiveBg` | `#2FAE82` / `#E3F6EC` | 準時、即將到站（充裕） |
| `warning` / `warningBg` | `#D97A3D` / `#FDE7D8` | 誤點、3 分鐘內到站 |
| `negative` / `negativeBg` | `#D1517E` / `#FDEEF0` | 錯誤、刪除、進站中 |

主要行動按鈕一律用 `gradient.primary`（`#8A7CEE → #6F5FD6` 水平漸層）＋ `shadow.cta`。

---

## 2. 字級

由大到小只有這幾階，**同一個層級的資訊永遠同一個大小**：

| token | 大小 | 用在什麼 |
| --- | --- | --- |
| `heroTitle` | 24px bold | 首頁主視覺大標 |
| `pageTitle` | 20px bold | 每頁最上方的 h1（我的行程／Ubike／設定） |
| `sectionTitle` / `cardTitle` | 14px semibold | 頁面內區塊標題、卡片主要內容 |
| `body` / `bodyStrong` | 14px | 清單主要內容、欄位裡選到的值 |
| `label` | 12px medium muted | 欄位小標（縣市、日期、時間） |
| `note` | 12px muted | 備註說明（真的在解釋一件事的句子） |
| `hint` | 12px faint | 空狀態、載入中、查無資料 |
| `meta` | 11px muted | 列表列的附註（距離、縣市、車程、方向） |
| `badge` | 11px medium | 徽章（路線色塊、到站時間、車次） |
| `micro` | 10px | 徽章裡的倒數、提醒時間這種最末端的附註 |

**最重要的一條規則：備註說明不會比內文大。**
以前「載入中…」「還沒設定…」「目前沒有其他小工具的使用權限」這些說明文字寫 `text-sm`
（14px），跟清單主要內容一樣大，看起來像正式內容而不是說明；現在一律壓到 12px 的 `hint`。
反過來，備忘錄卡片的「內容」是那張卡真正的主角，以前用 12px 看起來像附註，現在升到 `body`。

---

## 3. 間距、圓角、陰影

- 間距：`tight`(gap-2，圖示格) / `list`(gap-2.5，清單卡片) / `field`(gap-3，表單欄位) /
  `section`(gap-5，頁面區塊)。
- 圓角：`field`（輸入框、清單卡片）= `rounded-2xl`；`card`（班次卡、彈窗）= `1.5rem`；
  按鈕、徽章、分頁一律 `rounded-full`。
- 陰影：`card`（清單卡）/ `cardStrong`（班次卡）/ `cta`（主要按鈕）/ `pill`（分頁選中）/
  `float`（浮起的圓形小按鈕）。

---

## 4. 元件

### 文字
`PageTitle`、`SectionTitle`（可帶 ♦ 裝飾與右側操作鈕）、`FieldLabel`、`Note`（備註說明）、
`Hint`（空狀態／載入中）、`ErrorText`。

### 按鈕
| 元件 | 長相 | 什麼時候用 |
| --- | --- | --- |
| `PrimaryButton` | 實心漸層膠囊 | 頁面主要行動（`size="block"`：搜尋班次／搜尋附近站牌）、彈窗右下角（`size="inline"`：儲存／確定／新增並加入） |
| `GhostButton` | 純文字 | 取消 |
| `DangerButton` | 紅字 | 刪除 |
| `PillButton` | 淡紫底小膠囊 | 清單列尾（搜尋班次 →、立即導航 →） |
| `LinkButton` | 12px 紫色文字 | ‹ 重新搜尋、瀏覽文字命名路線、切換為手動輸入 |
| `AddButton` | 虛線框 | ＋ 新增… |
| `IconButton` | 圓形圖示 | 編輯筆、返回、加入、交換站點（`tone`：plain／soft／white） |

### 分頁與徽章
`SegmentedTabs`（`tone="soft"` 淡紫容器＋白色選中；`tone="solid"` 白色容器＋品牌紫選中，
只有結果頁的車種篩選用）、`Badge`（配色 class 由呼叫端傳，形狀統一）。

### 輸入
`Field`（小標＋控制項，右上角可放輔助操作）、`FieldRow`（兩欄並排）、`TextInput`、
`TextArea`、`SelectButton`。

**這個 App 不使用瀏覽器原生的 `<select>`、`<input type="date|time">`**——原生展開樣式是系統
內建的，跟整體視覺對不起來。所有「選一個值」的欄位都是 `SelectButton` ＋ 一個
`BottomSheetModal`（`StationPickerModal` / `DatePickerModal` / `TimePickerModal` /
`BusRoutePickerModal`）。

### 容器
`ListCard`（白底清單卡）、`DividedCard`（白底＋分隔線的清單）、`ScrollList` ＋
`ScrollListRow` ＋ `ListMessage`（有外框、可內部捲動的清單）、`EditorItemCard` ＋
`EditorItemHeader`（彈窗裡的「第 N 則」）。

### 彈窗
所有彈窗都是 `BottomSheetModal`（Portal 到 body、手機置底、桌面對齊手機框）。
- **選擇器**：直接用 `BottomSheetModal`，底部按鈕是「取消／**確定**」。
- **編輯器**：用 `EditorSheet`（`components/transit/editor-sheet.tsx`），底部按鈕是
  「刪除（靠左，選填）／取消／**儲存**」。

彈窗可以疊彈窗（編輯分類 → 選站牌 → 選縣市）：後開的因為 DOM 掛載順序比較晚，自然疊在
上面，不需要調 z-index。

---

## 5. 骨架（載入中）

**骨架的數量、每一列的高度、縮排都要跟載入完成後真正顯示的內容一致。** 骨架的用途是先把
版面佔好；列數猜錯的話資料回來那一刻畫面高度會跳一下，比沒有骨架更糟。

- 元件在 `components/transit/skeleton.tsx`：`SkeletonBar`、`ListRowSkeleton`、
  `CardListSkeleton`、`DividedRowsSkeleton`、`ScrollRowsSkeleton`、`ResultCardSkeleton`、
  `StopCardSkeleton`。
- 列數來自 `components/transit/skeleton-count.ts`——用 localStorage 記住「上次成功載入時的
  實際筆數」：
  - `loadSkeletonCount` / `saveSkeletonCount`：單一清單的筆數。
  - `loadSkeletonShape` / `saveSkeletonShape`：巢狀清單的形狀（我的行程：每個分類各自幾筆
    行程，例如 `[3, 1, 2]`）。以前是用「總行程數 ÷ 分類數」平均分配，筆數不平均時每個分類
    的骨架都對不上。
  - 上限 12 列。更長的清單（Ubike 一個縣市上百站、台鐵一天上百班）超出的部分本來就在第一
    屏之外，看不到高度跳動，但畫上百列骨架會讓載入本身變慢。
- **完全沒有上次紀錄時（新帳號、第一次查這組起訖站）不要猜一個固定數字**，顯示一行
  「載入中…」就好——新帳號很可能根本是空清單，先閃一排假骨架再變成空狀態更誤導。
- **筆數可預測的清單才畫骨架**：路線站序、站牌有哪些路線、附近站牌、班次清單、分類與行程。
  「搜尋結果」的筆數隨關鍵字變動、根本猜不到，那種顯示「搜尋中…」文字。

---

## 6. 文案用詞

同一件事在不同畫面要用同一個詞（定義在 `theme.ts` 的 `copy`）：

| 情境 | 用詞 |
| --- | --- |
| 被動載入（進頁面／打開彈窗就自己去抓的清單） | 載入中… |
| 使用者主動查詢（按了搜尋、打了字） | 搜尋中… |
| GPS 定位 | 定位中… |
| 失敗 | `<做什麼>查詢失敗，請稍後再試`（句型固定，不要有的帶「請稍後再試」有的不帶） |
| 彈窗確認鈕 | 選擇器＝確定；編輯器＝儲存 |
| 成功提示 | 新增成功／儲存成功／刪除成功／已加入行程 |

物件名稱（同一個東西只有一個叫法）：

| 概念 | 固定用詞 | 不要再用 |
| --- | --- | --- |
| 我的行程頁的第一層 | **分類** | 群組、清單 |
| 分類底下的一筆 | **行程** | 常用行程、路線收藏 |
| 首頁的小筆記 | **備忘錄** | 小小備忘錄 |
| 首頁最上方大圖 | **主視覺** | Banner、大圖 |
| 首頁下方小圖卡 | **橫幅** | 週末小旅行（那是內容的預設文案，不是功能名稱） |
| 設定頁 | **設定** | 其他 |
| 首頁設定彈窗 | **首頁設定** | 編輯首頁預設值 |
| 公車的站 | **站牌** | 站點 |
| Ubike 的站 | **站點** | 站牌 |

斜線一律用全形「／」。「＋ 新增…」後面接物件名稱（新增分類／新增行程／新增備忘錄／
新增區塊）。彈窗裡每一則的標題固定是「第 N <單位>」。

---

## 7. 互動

### 拖曳排序
可排序的清單都用同一顆握把（`DragHandle`）＋ `useDragReorder`
（`components/transit/use-drag-reorder.ts`）：

- 手機（觸控）跟桌面（滑鼠）走同一套 pointer 事件，不用 HTML5 `draggable`（觸控裝置根本
  不觸發），也不裝拖拉套件。
- 拖曳時直接即時換掉陣列順序，不拖半透明分身；握把本身 `touch-action: none`，按住拖不會
  變成捲動頁面。
- 放手才寫回（只有順序真的變過才送）。目前用在：我的行程的**分類**（打
  `PUT /api/transit/trip-groups` 帶 `orderedIds`）、分類底下的行程、備忘錄、主視覺／橫幅、
  天氣區塊（後四個是彈窗裡的本地陣列，按儲存時連同順序一起存）。
- 只有兩筆以上才顯示握把。

### 定位
不在進頁面時自動要求 GPS 權限，一定要使用者自己點「附近站牌／附近站點」才觸發。

---

## 8. API 呼叫（免費額度的省法）

TDX 的額度是**每分鐘 5 次**，CWA 也不該被濫打。四層防線，新增端點時照這個順序想一遍：

1. **伺服器端記憶體快取**（`tdx-client.ts` 的 `memCache`）：同一個 function instance 連續打
   同個 path 不會重打，順便讓同時進來的併發請求共用同一個 promise。
2. **MongoDB 快取**（`transit.tdxCache`）：Vercel 的 function instance 會被回收，記憶體快取
   在冷啟動後形同沒有；Mongo 這層撐得住。TTL 用 `TDX_TTL` 三階：
   `realtime`(60 秒，即時到站／誤點)、`dailyTimetable`(6 小時，某一天的時刻表)、
   `static`(24 小時，車站清單／票價／站序／捷運站間行車時間)。
   原始回應很大的端點（公車 StopOfRoute 整個縣市好幾 MB，可能撞到 MongoDB 單一文件 16MB
   上限而靜默失敗）要用 `persist: false`，由呼叫端壓成精簡版自己存一份——公車站序就是這樣
   存在 `transit.busRoutes`。
3. **瀏覽器 HTTP 快取**（`lib/transit/api-cache.ts` 的 `API_CACHE` ＋ `jsonCached`）：
   前面兩層只擋得住「真的去打外部 API」，瀏覽器每次換頁還是會重新請求我們自己的 route。
   掛上 `Cache-Control: private, max-age=…` 之後連請求都不會送出去。
4. **前端模組層級快取**：彈窗 remount 也留得住的 Map（公車選擇器）、整個分頁只請求一次的
   共用 promise（`lib/transit/train-cities-client.ts` 的台鐵站名清單）。

另外兩條原則：

- **merge／排序／裁切都在伺服器端做完**。附近站牌／附近站點以前是前端對 10～11 個縣市各發
  一次請求、把整包座標拉回瀏覽器才算距離；現在是一次請求（`/bus/nearby-stops`、
  `/ubike/nearby`），伺服器先用縣市中心點粗篩出最近的 3 個縣市（半徑 45 公里）再處理。
- **一次請求拿回整個畫面要的資料**。首頁天氣以前是「區塊數 × 2 天」個請求，而今天／明天本
  來就在同一包 CWA 回應裡；現在 `/weather/forecast?blocks=縣市|行政區,…` 一次回全部。
