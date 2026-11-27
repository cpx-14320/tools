# 入口與帳號 — 設計系統

> **入口頁、登入、註冊、管理後台、無權限畫面、圖片壓縮的樣式唯一依據。**
> 2026-11-28 建立，內容整理自 `app/globals.css` 的 `:root` 色票與 `components/ui.tsx`
> 的註解。跟 [rules](rules.md) · [status](status.md) · [history](history.md) 放在一起。

程式裡的對應實作是兩個檔案：

| 檔案 | 內容 |
| --- | --- |
| `app/globals.css` | `:root` 的 CSS 變數 ＋ `@theme inline` 把它們接成 Tailwind 的色名 |
| `components/ui.tsx` | 共用元件（`Button`、`ListCard`、`ListRow`、`IconTile`、`SectionLabel`、`Badge`、`FaIcon`） |

> **這套跟三個工具各自的 `theme.ts` 是不同的東西。** 三者的 `ink`／`muted` 根本不是同一個
> 顏色（雖然色碼有幾個剛好一樣），**不要互相 import**。記帳本改色票不會、也不應該影響登入頁。

---

## 1. 色票（`:root` 的 CSS 變數）

寫在 `globals.css`，經 `@theme inline` 變成 Tailwind 色名，所以畫面上寫的是
`bg-brand-soft text-brand` 這種語意 class，**不要再寫 `bg-[#6F5FD6]` 這種任意值**。

| 變數 | Tailwind | 色碼 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `bg-bg` | `#EFE9FB` | 頁面底（手機框外的桌面底色） |
| `--surface` | `bg-surface` | `#FFFFFF` | 卡片、彈窗白底 |
| `--surface-2` | `bg-surface-2` | `#F3EFFC` | hover 底、次級區塊底 |
| `--ink` | `text-ink` | `#4A3B7C` | 主要文字、標題 |
| `--muted` | `text-muted` | `#9C94C4` | 次要說明文字 |
| `--line` | `border-line` | `#ECE4FA` | 邊框、分隔線 |
| `--brand` / `--brand-soft` / `--brand-fg` | `text-brand` / `bg-brand-soft` | `#6F5FD6` / `#F3EFFC` / `#FFFFFF` | 品牌紫、淡紫底、紫底上的字 |
| `--lavender` / `--pink` / `--violet` | — | `#8B8DD8` / `#F6AECB` / `#C9A6F2` | 裝飾性漸層與插畫配色 |
| `--positive` / `--positive-soft` | `text-positive` | `#2FAE82` / `#E3F6EC` | 成功、已授權 |
| `--negative` / `--negative-soft` | `text-negative` | `#D1517E` / `#FDEEF0` | 刪除、錯誤、未授權 |
| `--icon` | — | `#ada0ff` | 線條圖示的預設色 |

主要按鈕的漸層是 `linear-gradient(90deg, #8A7CEE, #6F5FD6)`（`PRIMARY_BG`）＋
`shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]`。

### 分類色票（`--cat-a-*` ～ `--cat-m-*`）

十八組成對的 `-bg`（淡底）／`-fg`（實色）。它們是**記帳本的分類圓點**在用的，放在
`globals.css` 是因為那是全站唯一一份 CSS 變數表。新增要**成對加**，只加一半會讓那個分類的
圓點變透明。

## 2. 按鈕只有三種

| variant | 長相 | 什麼時候用 |
| --- | --- | --- |
| `primary` | 漸層實心 ＋ 陰影 | 送出、主要動作 |
| `secondary` | 白底紫框 | 次要動作 |
| `ghost` | 純文字 | 取消、關閉這類不想搶注意力的 |

**刪除這種警示動作用 `secondary` ＋ `text-negative` 蓋字色，不要另開一個 variant。**
三種樣式刻意比照記帳本的 `Button`，所以從登入頁按進記帳本時按鈕不會換一種長相。

## 3. 圖示一律 Font Awesome

這幾頁用 `components/ui.tsx` 的 `FaIcon`（字型在 `app/layout.tsx` 全站 import），
**不要用表情符號當圖示**：表情符號的長相由作業系統字型決定，大小與基線對不準旁邊的文字，
跟工具自己的插畫（`public/hub/*.png`）也不是同一種畫風。

`lib/tools-registry.ts` 的 `icon`（emoji）只是沒有插畫時的墊底值；有插畫填 `iconImage`，
沒插畫但想指定線條圖示填 `faIcon`。

記帳本、搭乘車各有一份同名的 `FaIcon`／`BrandMark`，**三邊刻意各自維護**——那是模組邊界。

## 4. 版面：一種版型，不管螢幕多寬

`SiteShell`：不管幾吋都是同一張置中的 **430px App 卡片**。卡片的尺寸／圓角／白邊／陰影／
漸層底**刻意跟 `ExpensesMobileShell` 完全一致**（`h-dvh`、`sm:h-[850px]`、`max-w-[430px]`、
`sm:border-[6px]`、同一條三段漸層），所以從登入頁按進記帳本時外框不會跳動。
兩邊各自維護一份樣式字串，但**數字要對齊**——改一邊就要改另一邊。

`header` 不在捲動區裡（`shrink-0`，`main` 才是 `overflow-y-auto`），所以內容再長，左上角的
返回鍵永遠看得到。

`IconTile`（清單列左邊那塊 40px 的圖示底）跟記帳本的 `IconAvatar` 同尺寸，所以兩邊的清單
並排看起來是同一套。`tone` 只有 `brand`（紫）與 `negative`（紅）兩種，紅的給刪除、鎖定那類列。

## 5. 圖片壓縮也走這一套

`app/tools/compress` 只有一頁，沒有自己的 `theme.ts`——它用這份的色票與 `components/ui.tsx`
的元件。**不要為了它開第四套設計系統。**
