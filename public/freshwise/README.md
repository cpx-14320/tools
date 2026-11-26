# public/freshwise｜網頁用圖

這個資料夾只放**網頁實際會載入的圖**，全部是 WebP。沒有母圖、沒有生成紀錄、沒有對照表。

| 要找什麼 | 去哪裡 |
| --- | --- |
| 母圖（PNG，不因網頁需求縮放或轉格式） | `小工具素材/圖片未壓縮/freshwise/`，對照表是同層的 `網頁素材對照.csv` |
| 素材怎麼生成出來的（提示詞、每一批做了什麼） | `小工具素材/菜鳥買菜記/素材生成批次紀錄.md` |
| 食材圖的來源對照（哪個農業部品項對應哪張圖） | `小工具素材/菜鳥買菜記/食材圖/ingredient-art-inventory.csv` |
| 各素材夾的現況對照 | 各夾底下的 `素材完整對照.csv`／`介面素材對照.json`／`各階段檔案對照.csv` |

`assets-manifest.json` 與 `asset-prompts.json` 在 2026-11-26 刪除了，舊文件提到「見兩份 JSON」時請往上表找。

**圖怎麼來的**：`npx tsx scripts/freshwise-build-web-images.mts`（從母圖重建，可重複執行）。
文字一律由 HTML 呈現——價格、來源、日期、單位、等級、進度、標題、按鈕都不寫進圖片。

---

## 檔名規則

```
item-<品項代碼>.webp                               品項插畫（code 對 catalog.ts）
item-farm-<農業部作物代號>.webp                     第二批之後照來源代號出圖的（對照在 art-assets.ts）
item-aquatic-<漁產代號>.webp / item-retail-<序號>.webp
dish-<料理>.webp                                   100 道料理（對照在 group-icons.ts 的 DISH_ICONS）
ui-<功能>.webp                                     介面圖示（名稱列在 game-art.tsx 的 GAME_ICONS）
pet-<食材>-<角色>-stage-0<階段>.webp                夥伴的平常樣子
pet-<食材>-<角色>-stage-0<階段>-<表情>.webp         surprised／happy／sad／curious
pet-<食材>-<角色>-stage-0<階段>-action-<動作>.webp  water／play
```

夥伴三個階段（Lv1-3／4-7／8+）用**同一套**命名。第三階原本沒有 `-stage-03`（基底叫
`pet-cabbage-tuantuan.png`、波波的平常表情又另外叫 `-neutral.webp`），`pet-expressions.ts`
因此得為它開兩個特例分支；2026-11-26 改名之後只剩「前綴＋階段＋後綴」。
`scripts/freshwise-companion-check.mts` 會驗這件事，再長出特例會直接失敗。

切片素材是 `<名稱>-left/-middle/-right.webp` 三片一組（吊牌、成長框、等級徽帶），
中段 `repeat-x` 隨寬度延伸；少一片不會報錯，只會露出背景色。

## 網頁用圖全部改成 WebP ＋ 依顯示尺寸縮圖（2026-11-26）

### 兩個資料夾，兩種規則

| | 位置 | 規則 |
| --- | --- | --- |
| 母圖 | `小工具素材/圖片未壓縮/freshwise/` | **不因網頁需求縮放、轉格式、改名**。檔名照網頁檔名命名，副檔名是原圖真正的格式 |
| 網頁用圖 | `cpx-tools/public/freshwise/` | 可以縮放、壓縮、改副檔名。壞了重跑腳本就好 |

重建指令（**一律從母圖出發**，不是拿網頁現有的圖再壓一次——後者每跑一次就多一層失真）：

```
npx tsx scripts/freshwise-build-web-images.mts          # 重建全部
npx tsx scripts/freshwise-build-web-images.mts --dry    # 只看會做什麼
npx tsx scripts/freshwise-build-web-images.mts pet-     # 只重建 pet- 開頭的
```

### 尺寸是怎麼決定的

畫面是 430px 寬的手機框（`.fw-phone` 的 max-width），所以**沒有任何素材需要超過 430 × 3 ＝ 1290px**。每一組的目標就是「這個素材最大顯示幾 px × 3」：

| 素材 | 原圖 | 網頁用 | 為什麼 |
| --- | --- | --- | --- |
| `item-*`（320 張，含 farm／aquatic／retail） | 256 PNG | **256 webp q82** | 最大顯示 80px（首頁攤位），256 已經夠，只轉檔 |
| `dish-*`（100 張） | 256 PNG | **256 webp q82** | 同上（食譜頁 80px、分類圖示 48px） |
| `ui-*`（29 張） | 256 PNG | **192 webp q82** | 介面圖示最大顯示 48px |
| `ui-paper-texture` | 1254 PNG | **512 webp q80** | 平鋪紙紋，實際以 128～160px 重複 |
| `pet-*`（126 張） | 1254 PNG | **640 webp q86** | 夥伴最大顯示 200px（首頁） |
| `garden-day-background` | 1448 PNG | **1290 webp q80** | cover 鋪滿手機框寬 |
| `collection-companion-atlas` | 1536 PNG | **900 webp q84** | 3×2 圖集，每格顯示 76px |
| `home-price-tag-board-clean` | 1254 PNG | **540 webp q84** | 價牌 max-width 174px |
| `page-market-awning-background` | 2172 PNG | **1290 webp q82** | 寬度跟著手機框 |
| `market-wood-counter-low` | 2172 PNG | **1290 webp q82** | 同上 |
| `market-small-price-card` | 528 PNG | **270 webp q84** | 小價卡顯示 88px 寬 |
| `companion-growth-frame-*`／`companion-level-ribbon-*` | 312／400 高 PNG | **高 120 webp q84** | 切片用 `background-size:auto 100%`，只看高度 |
| `home-market-wood-counter-board-web{,@2x,@3x}` | 384／768／1152 | **尺寸保留、轉 webp** | 這是 `image-set` 的 1x/2x/3x 階梯 |

### 兩個刻意不動的

- `home-quest-paper.webp`：CSS 的 `border-image … 240 180 228 300` 切片數值是**原始像素**，縮圖就得同步改那四個數字，框線會跑掉。
- `page-hanging-title-*.webp`：已經是 30KB 的輕量 WebP，重壓只是多一次失真。

### 改名牽動的程式

副檔名換掉之後這些地方要一起改，漏一個就是一張破圖（或一整排留白）：

| 檔案 | 什麼 |
| --- | --- |
| `lib/freshwise/catalog.ts` | `itemImage()`、`categoryImage()` |
| `lib/freshwise/art-assets.ts` | `ITEM_ARTWORK` 的檔名值、`itemArtwork()` |
| `lib/freshwise/pet-expressions.ts` | `petStageFile()`（三階七姿態一律 webp，特例全消失） |
| `components/freshwise/group-icons.ts` | `DISH_ICONS` 的 `file` |
| `components/freshwise/game-art.tsx` | `GameIcon` 的 `ui-<name>`、圖集、`SlicedArtwork`（`format` 參數拿掉了） |
| `components/freshwise/item-icon.tsx` | **`ITEM_CODE`／`CATEGORY_KEY` 兩條正規表示式** —— 它們從路徑反推代碼，漏改會讓整排品項變留白 |
| `components/freshwise/game.css` | 21 個 `url('/freshwise/*.png')` |
| `app/tools/freshwise/more/more-view.tsx` | 其他工具的圖示 |
| `components/freshwise/ui.tsx`、`go-top-button.tsx` | `ui-back`、`ui-go-top` |
