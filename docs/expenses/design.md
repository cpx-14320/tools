# 記帳本 — 設計系統

> **記帳本的樣式唯一依據。** 改這個工具的任何顏色、字級、間距之前讀這份。
> 2026-11-28 建立，內容整理自 `components/expenses/theme.ts` 的註解與實際用法。
> 跟 [rules](rules.md) · [status](status.md) · [history](history.md) 放在一起。

程式裡的對應實作是 `components/expenses/theme.ts`（token）。

規則只有一條：**畫面上不要再出現 token 以外的新數字、新顏色、新字級。** 需要一個現在沒有的
樣式時，先問「是不是既有 token 的某一階」，真的沒有才在 `theme.ts` 加一階並寫下理由。

> **這套只給記帳本用**（`components/expenses/**`、`app/tools/expenses/**`）。搭乘車有自己的
> `components/transit/theme.ts`、菜鳥買菜記有 `components/freshwise/theme.ts`，入口／登入／
> 註冊／管理後台走 `components/ui.tsx` ＋ `globals.css` 那套。
> **不要互相 import**——記帳本與搭乘車的紫看起來很像但不是同一組，混用的結果是「看起來
> 幾乎一樣但就是哪裡怪」。

---

## 1. 色票

| token | 色碼 | 用途 |
| --- | --- | --- |
| `ink` | `#4A3B7C` | 主要文字、標題、欄位值 |
| `muted` | `#9C94C4` | 次要說明文字、欄位小標 |
| `faint` | `#B3ABD4` | 更淡的輔助文字（空狀態、載入中、列表附註） |
| `border` | `#ECE4FA` | 一般邊框（輸入框、下拉選單、彈窗標題列分隔線） |
| `borderSoft` | `#F2EEFA` | 卡片內部的淡分隔線 |
| `surfaceSoft` | `#F3EFFC` | 淡紫底：pill 選單底、hover 底 |
| `surfaceActive` | `#EFEAFC` | 選中態底色 |
| `brand` / `brandLight` | `#6F5FD6` / `#8A7CEE` | 品牌紫（主要按鈕漸層的兩端） |
| `positive` / `positiveBg` | `#2FAE82` / `#E3F6EC` | 收入、達成、正向數字 |
| `negative` / `negativeBg` | `#D1517E` / `#FDEEF0` | 支出、刪除、錯誤 |

主要行動按鈕用 `gradient.primary`（`#8A7CEE → #6F5FD6` 水平漸層）＋ `shadow.cta`。
卡片用 `shadow.card`。

**收入綠、支出紅**——這跟搭乘車的「準時綠／誤點橘」是不同語意，兩邊共用同一組色碼只是巧合，
不要因此把兩個工具的 token 併成一份。

### 分類色票在 `globals.css`

分類的圓點顏色（`--cat-a-bg` ～ `--cat-m-fg`，十八組）定義在 `app/globals.css`，不在
`theme.ts`——那是**使用者自己挑的**分類顏色，不是介面語意色。新增色票要兩邊成對加
（`-bg` 淡底 ＋ `-fg` 實色），只加一半會讓那個分類的圓點變透明。

## 2. 字級

直接當 `className` 字串用（跟 `categoryColorClass` 同一種用法），不要每個頁面自己決定標題
與內文要多大。

| token | class | 用途 |
| --- | --- | --- |
| `text.pageTitle` | `text-xl font-bold` | 頁面主標 |
| `text.sectionHeading` | `text-sm font-semibold` | 區塊標題 |
| `text.body` | `text-sm font-medium` | 內文、欄位值 |
| `text.label` | `text-xs font-medium`（muted 色） | 表單欄位的小標籤（`Field` 元件用） |
| `text.muted` | `text-xs`（muted 色） | 次要說明 |
| `text.faint` | `text-xs`（faint 色） | 空狀態、載入中 |
| `text.statValue` | `text-lg font-bold tabular-nums` | 統計數字 |

`label` 跟 `muted` 同色但**字重不同**，不要混用：前者是「這一欄叫什麼」，後者是「附帶說明」。

金額一律 `tabular-nums`——等寬數字才會對齊成一直線，一排金額位數不同時才不會看起來歪斜。

## 3. 間距

卡片／區塊／欄位之間統一用這幾階，不要每頁自己湊 `gap-3`／`gap-4`／`gap-5`：

| token | 值 | 用途 |
| --- | --- | --- |
| `spacing.tight` | `gap-1.5` | 格子選擇器（分類格、帳戶類型格）這種本來就密集的排列 |
| `spacing.card` | `gap-3` | 同一張卡片內：標題跟內容、內容跟內容 |
| `spacing.field` | `gap-4` | 表單裡欄位跟欄位之間 |
| `spacing.section` | `gap-4` | 頁面裡一個區塊跟下一個區塊 |
| `spacing.page` | `gap-4` | 頁面層級 |

## 4. 兩組共用的狀態 class

這兩組是「同一種互動在不同頁面要長一樣」的結果，不要在頁面裡另外寫一次：

| token | 值 | 什麼時候用 |
| --- | --- | --- |
| `unselectedOption` | `opacity-40 hover:opacity-70` | 「一排東西挑一個」裡**沒被選中**的那些（圖示選擇器、格子選擇器）。**一個都還沒選的時候不要套**——整排都是暗的看起來像全部不能點 |
| `activeSolid` | `bg-[#6F5ED4] text-white` | 「選中／生效中」反白成實心紫底白字（報表頁的支出／收入／淨額／資產分頁、消費紀錄的篩選膠囊） |

`activeSolid` 的色碼 `#6F5ED4` 跟 `colors.brand` 的 `#6F5FD6` **差一階**，那是歷史造成的：
以前兩邊各寫一次、同一個 App 裡出現兩種幾乎一樣的紫。現在統一走這個常數，要改選中色改這一處。

## 5. 版面

- **只有手機版版面**（寬螢幕是置中的 430px 手機框，`ExpensesMobileShell`）。入口頁與登入頁
  的外框數字刻意跟它對齊（`h-dvh`、`sm:h-[850px]`、`max-w-[430px]`、`sm:border-[6px]`），
  所以跳頁時外框不會晃——改任何一邊的數字要兩邊一起改。
- **骨架（skeleton）已經全部移除**。只有搭乘車還在用。
- 釘住的工具列一律走 `StickyToolbar`（細節見 [rules.md](rules.md) 的「操作面的規範」）。
