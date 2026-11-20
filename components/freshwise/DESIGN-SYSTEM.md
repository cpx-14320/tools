# 菜鳥不買貴（FreshWise）— 設計系統

這份文件是這個工具（`app/tools/freshwise/**`、`components/freshwise/**`）的唯一樣式依據。
程式裡對應的實作是兩個檔案：

| 檔案 | 內容 |
| --- | --- |
| `components/freshwise/theme.ts` | 色票、字級、間距、圓角、陰影、文案用詞的 token |
| `components/freshwise/ui.tsx` | 通用元件（文字、按鈕、輸入、容器、分頁、徽章、拖曳握把） |

規則只有一條：**畫面上不要再出現 token 以外的新數字、新顏色、新字級。** 需要一個現在沒有
的樣式時，先問「是不是既有 token 的某一階」，真的沒有才在 `theme.ts` 加一階並寫下理由。

> 這套只給菜鳥不買貴用。搭乘車有自己的 `components/transit/theme.ts`（紫）、記帳本有
> `components/expenses/theme.ts`（紫），登入／註冊／管理後台走 `components/ui.tsx` ＋
> `globals.css`。四套的 ink／muted 不是同一個顏色，**不要互相 import**。
> 結構（token 名稱、字級階層、文案用詞表）則刻意跟搭乘車一模一樣，讀一個工具學到的規則
> 在另一個工具也成立。

---

## 1. 色票

| token | 色碼 | 用途 |
| --- | --- | --- |
| `ink` | `#2A4A36` | 主要文字、標題、價格數字 |
| `muted` | `#6F947E` | 次要說明文字、欄位小標 |
| `faint` | `#9BB9A6` | 空狀態、載入中、列表附註 |
| `placeholder` | `#B9D2C2` | 還沒填的值、裝飾性箭頭 |
| `border` | `#E0EFE5` | 輸入框／選擇器邊框、彈窗標題列分隔線 |
| `borderSoft` | `#EEF7F0` | 卡片內部的淡分隔線 |
| `surfaceSoft` | `#EFF7F1` | pill 選單底、hover 底、圖示格底 |
| `surfaceActive` | `#E4F2E9` | 選中態底色 |
| `surfaceHover` | `#F6FBF7` | 清單列 hover |
| `brand` / `brandLight` | `#3C9A62` / `#5EC183` | 品牌綠（主要按鈕漸層的兩端） |
| `skeleton` | `#DCECE1` | （目前沒用到，見第 5 節） |
| `up` / `upBg` | `#D4553F` / `#FBEAE4` | **漲價**、偏貴 |
| `down` / `downBg` | `#2E8F6B` / `#E2F3EA` | **跌價**、划算 |
| `warning` / `warningBg` | `#B5812B` / `#FAF1DD` | 當季標籤、休市公告、估算值說明 |
| `negative` / `negativeBg` | `#C94F6D` / `#FCEDF1` | 刪除、錯誤訊息 |

**漲紅跌綠**（台灣看盤的習慣，對買菜的人來說綠色剛好也是好消息）。`up` 刻意用偏磚紅的
橘紅，跟刪除用的 `negative`（偏桃紅）分得開；`down` 比品牌綠更深、彩度更低，不會跟按鈕
的品牌綠搞混。

主要行動按鈕一律 `gradient.primary`（`#5EC183 → #3C9A62`）＋ `shadow.cta`；首頁主視覺用
`gradient.hero`（深一階的三段綠）。

---

## 2. 字級

| token | 大小 | 用在什麼 |
| --- | --- | --- |
| `heroTitle` | 24px bold | 首頁主視覺的買菜建議句 |
| `pageTitle` | 20px bold | 每頁最上方的 h1 |
| `priceBig` | 28px bold | 詳情頁的今日價、菜籃的整籃金額 |
| `priceRow` | 17px bold | 清單每一列的價格 |
| `sectionTitle` / `cardTitle` | 14px semibold | 區塊標題、卡片主要內容 |
| `body` / `bodyStrong` | 14px | 清單主要內容、欄位裡選到的值 |
| `label` | 12px medium muted | 欄位小標 |
| `note` | 12px muted | 備註說明（真的在解釋一件事的句子） |
| `hint` | 12px faint | 空狀態、載入中、查無資料 |
| `meta` | 11px muted | 列表列的附註（市場、單位、產季） |
| `badge` | 11px medium | 徽章（漲跌、划算、當季、估算） |
| `micro` | 10px | 徽章裡最末端的附註 |

比搭乘車多出 `priceBig` 與 `priceRow` 兩階，因為這個工具的主角就是價格數字——清單列的
價格如果跟品名一樣 14px，整頁看起來就是一片文字，看不出重點。**這兩階只准放價格。**

**備註說明永遠不會比內文大。**

---

## 3. 間距、圓角、陰影

- 間距：`tight`(gap-2) / `list`(gap-2.5，清單卡片) / `field`(gap-3，表單欄位) /
  `section`(gap-5，頁面區塊)。
- 圓角：`field`（輸入框、清單卡）= `rounded-2xl`；`card`（價格卡、彈窗）= `1.5rem`；
  按鈕、徽章、分頁一律 `rounded-full`。
- 陰影：`card`（清單卡）/ `cardStrong`（價格卡、主視覺）/ `cta`（主要按鈕）/
  `pill`（分頁選中）/ `float`（回頂部按鈕、區間指示點）。

---

## 4. 元件

### 通用（`ui.tsx`）
`PageTitle`、`SectionTitle`（可帶葉子裝飾與右側操作）、`FieldLabel`、`Note`、`Hint`、
`ErrorText`、`Callout`、`PrimaryButton`、`GhostButton`、`DangerButton`、`PillButton`、
`LinkButton`、`AddButton`、`IconButton`、`SegmentedTabs`、`Badge`、`Field`、`FieldRow`、
`TextInput`、`SearchInput`、`SelectButton`、`Switch`、`ListCard`、`DividedCard`、
`DividedRow`、`ScrollList`、`ScrollListRow`、`ListMessage`、`EmptyState`、
`EditorItemCard`、`EditorItemHeader`、`DragHandle`。

`Note` 與 `Callout` 的分工：`Note` 是「順便說一下」，`Callout` 是「你必須知道這件事才不會
誤解上面的數字」（有底色與圖示）。只有這幾種情況用 `Callout`，句子都定義在 `theme.ts` 的
`copy` 裡：估算值說明、零售訪價只有臺中、批發休市、資料日期不是今天、資料來源。

### 這個工具特有的
| 元件 | 檔案 | 說明 |
| --- | --- | --- |
| `ItemRow` | `item-row.tsx` | 品項的一列。首頁、行情、菜籃三處共用，版面固定是「圖示格 → 品名與徽章 → 說明 → 價格與漲跌」，可選的拖曳握把在最左、星星在最右 |
| `PriceText` / `PriceRange` | `price-text.tsx` | **全工具唯一把元/公斤換算成顯示單位的地方** |
| `TrendBadge` / `ValueBadge` / `SeasonBadge` / `EstimatedBadge` | `badges.tsx` | 語意色徽章，判定邏輯來自 `lib/freshwise/price.ts` |
| `PriceChart` / `Sparkline` | `price-chart.tsx` | 手刻 SVG 走勢圖（單數列、十字準星、只標最高最低與最後一個值） |
| `ItemIcon` | `item-icon.tsx` | 品項／分類圖示。先試圖片、沒有就退回向量圖示（見下面的「圖片」） |
| `MarketPickerModal` | `market-picker-modal.tsx` | 市場選擇器。清單是從實際資料長出來的，不是寫死的 |

### 輸入與選擇
**這個 App 不使用瀏覽器原生的 `<select>`、`<input type="date|number">`**——原生展開樣式是
系統內建的，跟整體視覺對不起來，手機上的數字欄位還會多出上下箭頭。所有「選一個值」的欄位
都是 `SelectButton` ＋ 一個 `BottomSheetModal`（`MarketPickerModal`、`ItemPickerModal`、
`basket-sheets.tsx` 裡的分類選擇）。

### 彈窗
所有彈窗都是 `BottomSheetModal`（Portal 到 body、手機置底、桌面對齊手機框）。
- **選擇器**：直接用 `BottomSheetModal`，底部按鈕是「取消／**確定**」。
- **編輯器**：用 `EditorSheet`，底部按鈕是「刪除（靠左，選填）／取消／**儲存**」。

彈窗可以疊彈窗（編輯項目 → 選分類）：後開的 DOM 掛載順序比較晚，自然疊在上面，不用調
z-index。每個彈窗都用「算繪期間調整 state」的方式在 `open` 轉成 true 時重設表單，上一次
沒確認的選擇不會留到下一次。

---

## 5. 載入中與骨架

**這個工具沒有骨架元件，也不需要。** 所有價格都是 Server Component 在伺服器端讀好
（`lib/freshwise/prices.server.ts`）再當 props 傳下來的，畫面上沒有「資料還在路上」的
狀態——跟記帳本一樣（記帳本改成 Server Component 之後，骨架全部刪掉了）。

唯一的例外是**我的菜籃**：它還存在 `localStorage`，要等瀏覽器掛載後才讀得到。那一段用
`store.tsx` 的 `basketReady` 旗標處理——還沒讀完時顯示「載入中…」一行文字，不要先畫預設
菜籃再換掉（會閃一下）。偏好設定已經改存 cookie，伺服器第一次算繪就是對的值，所以分頁
不需要再吃 `ready`。

換場所或市場時會 `router.refresh()` 讓伺服器重算一份價格——那段期間 Next.js 會沿用舊畫面，
不需要我們自己畫載入狀態。

之後如果真的出現要等網路的清單，再照搭乘車那套（`skeleton-count.ts` 記住上次筆數）加回來，
不要憑空寫死列數。

---

## 6. 文案用詞

同一件事在不同畫面要用同一個詞（定義在 `theme.ts` 的 `copy`）：

| 概念 | 固定用詞 | 不要再用 |
| --- | --- | --- |
| 三種價格來源的統稱 | **場所** | 通路、管道、地點 |
| 個別場所 | **傳統市場／超市量販／批發行情** | 市場、超市、批發市場（單獨講） |
| 收藏頁 | **我的菜籃** | 最愛、追蹤、常買清單 |
| 菜籃的第一層 | **分類** | 群組、清單 |
| 分類底下的一筆 | **項目** | 品項（那是指目錄裡的菜本身）、收藏 |
| 市場選擇器裡的單位 | **市場** | 站點、通路 |

- 失敗訊息一律「`<做什麼>`查詢失敗，請稍後再試」。
- 彈窗確認鈕：選擇器＝確定；編輯器＝儲存。
- 成功提示：新增成功／儲存成功／刪除成功／已加入菜籃／已從菜籃移除。
- 斜線用全形「／」，「＋ 新增…」後面接物件名稱（新增分類／新增項目）。

---

## 7. 誠實標示（這個工具特有的規則）

這個工具的數字關係到使用者花錢，所以有五條不能妥協的標示規則：

1. **沒有實際訪價的數字一律標「估算」。** 超市量販整個場所都是推估的（沒有任何免費開放
   資料可接）；傳統市場則是「臺中有訪價的品項用真實訪價、其他品項用批發價推估」。切到
   推估的場所時頁面上要出現 `Callout`，詳情頁要寫出每一筆的來源（`SOURCE_LABEL`）。
   超市量販也刻意不掛任何真實品牌，不要讓畫面看起來像某一家店的實際報價。
2. **批發價不是消費者付的錢。** 它可以出現在比價表與走勢圖裡（看漲跌最準），但「最便宜」
   這種推薦標籤只在消費者真的買得到的場所之間比（傳統市場 vs 超市量販）。
3. **歷史不夠長就不下結論。** 不到 30 天不顯示划算度與區間（改說「歷史資料累積中」）；
   不到 300 天時比較基準寫「過去 N 天的平均」而不是「近一年的平均」——那一句由
   `price.ts` 的 `historyLabel` 統一決定，**不要在畫面上自己寫「近一年」**。
4. **首頁的頭條建議優先用實際訪價的品項**，真的只有推估值時句子裡標「（推估）」。推估值
   經係數放大後波動更劇烈，很容易霸占「今天最划算」的前幾名。
5. **資料日期不是今天就要說。** 批發市場週一休市、來源也常常延遲一天，畫面上要寫出實際的
   資料日期與原因，不能讓人以為看到的是今天的價。

每一頁底部都有一個 `Callout` 寫出資料來源（`copy.sourceNote`）。

### 圖片

品項與分類的圖示走「有圖就用圖、沒圖退回向量圖示」（`ItemIcon`）：圖片路徑是
`public/freshwise/items/<品項代碼>.png` 與 `public/freshwise/categories/<分類>.png`，
檔案還沒放進去之前畫面顯示 Font Awesome 的向量圖示，放進去之後不用改程式。
**不要在畫面上直接用 `FaIcon` 畫品項圖示**，那樣以後補圖要改好幾個地方。
