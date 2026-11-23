# FreshWise 圖片素材

畫風依據：`UIUX示意設計稿/FreshWise_V2_蔬果夥伴`。本批使用內建 image_gen 生成，插畫不含價格或介面文字。

| 區域 | 檔案／用途 |
| --- | --- |
| 今日／夥伴舞台 | `scene/garden-day-background.png`，無角色與文字的花園背景 |
| 養成角色 | `companions/pet-<食材>-<角色>.png`，六位角色獨立透明 PNG |
| 圖鑑 | `companions/collection-companion-atlas.png`，3×2 格 |
| 導覽與功能 | `ui/ui-illustrated-icon-atlas.png`，6×4 格，含導覽、六類食材、搜尋、篩選、種子袋、澆水、陪玩、信封等 |
| 紙張 | `ui/ui-paper-texture.png`，重複平鋪細紙紋 |
| 實際品項 | `items/item-catalog-atlas-01.png` 到 `04.png`，依目前有資料來源的 95 個品項生成，各 6×4 格 |

`assets-manifest.json` 列出每個功能和品項的格位、原生尺寸、CSS 最大顯示尺寸、實際倍率。
`asset-prompts.json` 保存完整生成提示詞，後續生成同系列請一起參考設計稿及本批原始插畫。

角色、品項與功能圖示達 6 倍以上；花園場景原生為 1448×1086，430px 寬使用時約 3.37 倍，未達 6 倍，未以普通放大冒充更高原生解析度。
價格、來源、日期、單位、等級、進度、標題與按鈕文字請使用 HTML，不寫入圖片。

固定品項代碼對照位於 `lib/freshwise/art-assets.ts`。先前的 `items/<代碼>.png` 和 `categories/<分類>.png` 呼叫仍作為辨認品項／分類的穩定鍵，元件會轉用對應圖集，不會逐筆請求不存在的 PNG 或退回系統圖示。
圖示為食材插畫，不代表個別市場貨品的外觀、規格、品級或產地；實際資料由頁面文字顯示。

## 首頁插畫價牌（2026-11-21）

新增 `home/home-price-tag-board.png`：無文字的吊繩紙牌、木箱與蔬葉透明插畫，原生 1145×1374，網頁最大顯示寬 184px，約 6.22 倍。品名、價格、單位、漲跌與連結使用 HTML 疊在留白區，價格與單位並排。

主要呼吸動畫角色更新為 200×200px，1254px 原圖對應約 6.27 倍解析度。首頁保留成長數值和進度條，移除「再 X 成長升級」文字。

## 小尺寸簡化素材 V3（2026-11-21）

使用內建 image_gen 參考舊圖集與糰糰角色重新生成，減少細節、統一粗棕色輪廓，移除浮在外側的橘色／藍色點線裝飾。原始圖集完整保留。
目前網頁改用 `ui/simple/ui-<功能>.png`（24 張）及 `items/simple/item-<品項代碼>.png`（95 張），皆為 256×256 透明 PNG，主體等比例置中並保留透明邊距。生成母圖保存在 `source/simple-v3/`，固定品項代碼繼續由 art-assets.ts 維護；manifest 同時保存現用檔案與 legacyAtlas。
256px 在 40px 顯示時為 6.4 倍，標題 48px 時為 5.33 倍，依本次指定單張 256px 規格，未宣稱達 6 倍。
完整提示詞保存在 asset-prompts.json 的 simpleV3。

## 首頁市集 V4

新增無繩無洞價牌 `home/home-price-tag-board-clean.png`、木檯 `ui/market-wood-counter.png`、任務紙 `ui/task-paper-slip.png`、空白小價牌 `home/market-small-price-card.png`。皆使用內建 image_gen；原始素材保留。完整提示詞位於 asset-prompts.json/homeMarketV4。價格、食材、任務進度皆為動態 HTML；背景不烘焙食物或價錢。原生尺寸與實際倍率以 manifest 為準，未放大冒充原生六倍。

## 水彩紙紋 UI V5

24 個功能圖示使用內建 image_gen 參考原始價牌重新生成，增加顏料沉積、紙纖維、乾筆與木紋，維持粗棕輪廓、小尺寸辨識和無外側點線裝飾。現用單圖 `ui/textured-v5/ui-<功能>.png`，皆為 256×256 透明 PNG；舊圖與 V3 單圖保留。母圖及 32px 預覽位於 `source/textured-v5/`，完整提示詞位於 asset-prompts.json/texturedUiV5。

## 可延伸任務紙（2026-11-22）

重新生成直立側邊的紙張母圖，裁切為 `ui/task-paper-slip-top.png`、`ui/task-paper-slip-middle.png`、`ui/task-paper-slip-bottom.png`。上下段使用固定 aspect-ratio，中段 background-size:100% auto / repeat-y，隨文字長度延伸；原 task-paper-slip.png 保留。母圖位於 source/task-paper-slices/，提示詞及裁切尺寸保存在 asset-prompts.json/taskPaperSlices。

## 花園插畫介面 V6

價牌配合寵物線條重繪並加入地面接觸陰影；任務紙以較高的上下圓角切片銜接可重複中段。新增 companion-nameplate.png、companion-level-ribbon.png、companion-growth-frame.png、companion-water-button.png、companion-play-button.png。文字、進度及按鈕互動由 HTML 保持可讀可用，所有樣式集中 game.css。原生尺寸與倍率見 manifest，完整內建 image_gen 提示詞位於 asset-prompts.json/gardenPolishV6。

### V6 延伸與素材整理

按鈕、等級牌及成長框實際使用 `*-left.png`、`*-middle.png`、`*-right.png`，左右依高度維持比例，中段 repeat-x 隨文案寬度延伸。夥伴名稱 h2 已依要求移除。未引用的名稱牌及完整切片母圖移入 unused/，對照記錄於 manifest/unusedMovesV6；其他動態品項、角色和圖示保留。

## 寵物互動表情 V7（2026-11-22）

六位夥伴各有驚訝 `surprised`、開心 `happy`、難過 `sad`、疑問 `curious` 四張獨立透明 WebP，命名 `pet-<食材>-<角色>-<表情>.webp`，平放 public/freshwise/。以內建 image_gen 逐張編輯原角色；保留實心深色眼睛，糰糰與蹦蹦保留 ω 雙弧嘴型，波波只保留鼻子、沒有嘴巴線條。每張保留原畫布尺寸並校準外框、腳底位置，不使用表情圖集。原生 1254px 在 200px 顯示為 6.27 倍，首頁最大 212px 時約 5.92 倍。

首頁與夥伴頁可點角色或用 Enter／空白鍵隨機切換，不會連續抽到同一表情；切換不消耗露珠或改變養成進度。點擊後才載入下一張壓縮 WebP，新圖解碼完成前保持舊圖；載入失敗保留舊圖並允許重試。微動效遵守 prefers-reduced-motion。完整提示詞及素材資料見 asset-prompts.json、assets-manifest.json 的 petExpressionsV7。

波波的平常表情另外使用 "pet-eggplant-bobo-neutral.webp"，原 "pet-eggplant-bobo.png" 也同步修正為只有鼻子的參考原圖；前一版含嘴巴的原圖保存在 "unused/pet-eggplant-bobo-before-nose-only.png"。暖暖依原始側臉只露出右側一隻眼睛，嘴巴保持在左側鼻子下方。

## 圖示與小價牌修正 V8（2026-11-22）

使用內建 image_gen 重新生成 market-small-price-card.png（528×648，88×108 版位的六倍素材）、ui-calendar.png 與 ui-leaf.png（皆256×256）。小價牌加強與首頁寵物一致的棕色輪廓，日曆保留完整三個線圈與外框，雙葉移除右側殘片並依可見主體置中，四周保留透明安全邊距。舊圖保存在 unused/*-before-v8.png，完整提示詞與尺寸見兩份 JSON 的 uiAssetPolishV8。

夥伴頁澆水、陪玩恢復 CSS 漸層膠囊按鈕，六張舊按鈕切片移入 unused/；角色區取消固定最小高度，縮短至成長進度條的留白，等級名牌縮小。詳情頁移除角落寵物結構，紙卡內距四邊統一16px。樣式集中 game.css。

首頁、行情與菜籃的 ItemRow 以及詳情頁的場所比價、各市場簡表共用 PriceListRow；外框統一使用 Paper variant=list。完整行情表保留表格結構，單位換算、來源與估算標示繼續使用原本資料。

## 其他小工具 V9（2026-11-22）

設定頁新增「其他小工具」，使用 ui-tool-transit.png、ui-tool-expenses.png、ui-tool-compress.png，皆256×256獨立透明PNG。由內建 image_gen 參考 ui-home.png、ui-market.png 逐張生成，統一棕色粗線、水彩紙紋和透明留白；連結沿用 TOOLS_REGISTRY 與登入帳號的工具權限。提示詞與尺寸保存於兩份JSON的 otherToolsV9。

菜籃分類新增入口移至右下浮動操作列，回到頂部按鈕位於其下，清單短時也保留新增入口；標題右側及清單底部重複入口移除。操作列避開底部導覽與安全區，預留清單底部空間；彈窗沿用原本 GroupEditorSheet。

## 任務與吊牌 V10

單任務使用 home-quest-paper.webp；三任務使用 companions-quests-paper-top/middle/bottom.webp，上下固定圓角、中段垂直重複延伸。三個頁面的標題使用 page-hanging-title-left/middle/right.webp，由共用 PageTitle 與 SlicedArtwork 依文字長度延伸。皆內建 image_gen 生成，文字／進度／獎勵保持 HTML。完整提示詞與實際尺寸見 JSON 的 questAndHangingV10，未放大冒充原生六倍。

三頁頂部共用透明 page-market-awning-background.png：棚布延伸至頂部，無天空、無下方米色底；行情副標位於棚內。菜籃標題22px並上移，其他吊牌20px。露珠與圖鑑按鈕共用 paper-deep 純底色。行情頁移除條件摘要、清除按鈕及清除函式，搜尋與分類、篩選切換保留。

## 常見食材與料理 V12（2026-11-22）

新增40種常見食材與30道料理，各自為獨立256×256透明PNG，平放本資料夾。既有目錄缺圖沿用item-<code>.png；預備擴充食材使用item-<ingredient>.png；料理使用dish-<dish>.png。兩份JSON的foodAndDishesV12列出中文名稱、檔名、實際原生尺寸與完整內建image_gen提示詞。

料理另提供WebP供分類選擇器使用，只有開啟新增／編輯分類時載入。DISH_ICONS保存30道料理名稱與圖示key；新分類點料理會帶入名稱，自訂名稱保留。新增食材及常買份量沿用既有菜籃功能，價格與資料來源對應不因素材而改動。40種食材中尚未接上行情的素材保留供後續資料擴充使用。
## 100道料理 V13（2026-11-22）

在原30道料理之外再新增70道，現在DISH_ICONS共100道。每道料理皆有獨立256×256透明PNG與輕量WebP，平放本資料夾，沿用dish-<dish>.png/webp命名。新增素材的原生尺寸、完整內建image_gen提示詞及名稱保存在兩份JSON的dishes100V13。常見料理選單使用四欄，料理圖示透過next/image延後載入原有WebP，原30道圖案與已儲存圖示key保留相容。
## 食材代碼補圖 V14（2026-11-23）

11 張既有預備食材直接更名為 FF1–FF8、FG1–FG3 對應檔名，PNG 內容不變，兩份 JSON 中的引用一併更新。青花苔 FF9 依農業部食農平台的青花菜別名說明，複用 FD4 插畫；保留原 FD4 檔案供青花菜使用，不更動目錄或行情映射。

西洋芹 FG4、皇宮菜 FG5、鬼頭刀 HA9、肉魚 HB8、黃魚 HB9、黑鯧 HC1、四破魚 HC2、虱目魚肚 HC4 使用內建 image_gen 各別生成，參考既有食材圖的粗線與紙紋。全部以獨立256×256透明PNG平放本資料夾。完整提示詞、原生尺寸、更名前後對照與檔案資訊見兩份JSON的missingItemArtV14。

## CSV 未顯示食材補圖 V15（2026-11-23）

逐列核對402筆來源資料，385筆具名資料規劃對應294張插畫。目前已備妥207張（73張既有、134張本次新生成），尚有87張待生成；17筆未具名品項列在略過清單。相同食材的進口、包裝與可共用規格不重複生成，外觀有差異者各自補圖。既有16張英文預備食材檔直接改名，圖像內容不變。鳳梨花B4依北農具名來源列另備花序插畫，僅備素材，不因此加入食材或行情目錄。

新素材皆為獨立256×256透明PNG，使用內建image_gen參考原食材系列生成。來源代碼與專案內碼不同，因此新預備圖採item-farm-<來源代碼>.png及item-aquatic-<來源代碼>.png，零售沒有來源代碼者採item-retail-<流水號>.png，避免覆蓋原本item-FA1等插畫。不自動新增行情品項、價格或來源映射。完整來源對照見csv-ingredient-art-map.csv/json，略過列見csv-ingredient-art-skipped.csv，尚待生成清單見csv-ingredient-art-pending.csv；完整已完成與待生成提示詞見兩份JSON的csvMissingIngredientsV15。

水果與零售食材圖片已完成；依使用者明確要求，水產87張先暫停，保留pending清單，不自動接續生成。

## 甜瓜補圖 V16（2026-11-23）

新增256×256透明PNG：item-farm-V1.png。以內建image_gen參考原水果插畫生成淡白綠光滑外皮、白肉的美濃瓜，GC7透過art-assets.ts共用此圖。CSV的V1美濃瓜與V0一般甜瓜對應此圖；GC4哈密瓜與溫室吊瓜原對應保留。本次圖稿、原生尺寸與提示詞見兩份JSON的sweetMelonV16。CSV已生成123張、尚待98張；先前50張批次紀錄保留。

## 水果與零售食材補圖 V17（2026-11-23）

本輪新增10張水果與1張零售牛心柿圖，共11張獨立256×256透明PNG。原本零售欄位的紅柿、桶柑與海梨柑沿用既有圖。至此CSV水果及零售具名品項皆有圖，CSV新圖累計134張；水產87張依使用者要求暫停，不自動續作。檔名與尺寸見csv-ingredient-art-fruit-retail.csv/json，完整提示詞在csvMissingIngredientsV15.generated。

## 矮版行情木檯 V18（2026-11-23）

依實際行情頁分類木檯另製market-wood-counter-low.png，2172×724透明PNG，原圖與既有CSS引用保留。新圖木檯可見高度301px（原636px，約47%），縮短檯面深度與前擋板，頂邊位置近似原圖，下方保留透明區，可沿用原背景容器比例。內建image_gen重繪並去除外圍霧狀背景，未以垂直壓縮原圖代替重繪；完整提示詞、清理提示詞與原生尺寸見兩份JSON的marketCounterLowV18。


## 未使用圖片整理（2026-11-24）

依目前程式、CSS與動態素材對照表，將246張未使用圖片移至unused，保留348張網頁素材。料理與照護圖片保留網頁使用的WebP，PNG原稿歸檔；尚未接上目錄的120張預備食材圖也歸檔，未刪除圖片。完整舊、新路徑與SHA-256見unused/asset-archive-index.json，CSV素材對照表已更新為實際路徑。歷史生成紀錄保留，查找舊檔請對照兩份JSON的assetCleanupV23。

csv-ingredient-art-pending.csv仍有87項水產待生成，依先前要求維持暫停，保留供後續補圖追蹤。


## APP 介紹圖 V24（2026-11-24）

三個系列：功能總覽、逛逛行情、菜籃與夥伴。每組各有3200×1800橫式與1800×3200直式，六種設計各輸出PNG原稿與輕量WebP，共12個圖檔，平放本資料夾。外圍插圖由內建image_gen重新生成；介面使用實際網頁高像素密度截圖，保留文字與價格，包含捲動後的份量彈窗、任務與價格走勢。依原比例裁切與編排，未重畫或拉伸成電腦版。完整提示詞、截圖區域與文案位置見app-intro-series-prompts.json。這些是公開介紹用素材，即使未被應用程式引用也有獨立用途，不列入未使用UI素材清理。


<!-- freshwise-aquatic-v25-start -->
## 水產食材補圖 V25（2026-11-24）

依使用者要求恢復水產圖示製作，目前完成44／87張，剩餘43張。皆為獨立256×256透明PNG，平放本資料夾，依漁產品來源代碼命名。現有圖片先比對，未更動食材目錄、行情來源或API映射。原生生成尺寸與完整提示詞見兩份JSON的csvAquaticArtV25，完成對照表見csv-ingredient-art-aquatic.csv/json。尚待生成項目保留在csv-ingredient-art-pending.csv。

<!-- freshwise-aquatic-v25-end -->
