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
