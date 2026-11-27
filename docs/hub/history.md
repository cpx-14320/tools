# 入口與帳號（hub）— 已完成紀錄

> 2026-11-27 建立。這一層以前沒有獨立文件，決策都寫在檔頭註解裡。
> 往後做完一輪就往下疊一節。

## 已知的重要決策（從檔頭註解整理，日期不詳）

| 決策 | 在哪個檔案的檔頭 |
| --- | --- |
| 五頁統一成 430px 單一版型（放棄「手機／桌機兩套 responsive」） | `components/site-shell.tsx` |
| 外框數字刻意跟 `ExpensesMobileShell` 對齊，所以跳頁時不晃 | `components/site-shell.tsx` |
| 圖示一律 Font Awesome、不用表情符號 | `components/ui.tsx` 的 `FaIcon` |
| 三個工具各自維護一份同名的 `FaIcon`／`BrandMark`（模組邊界，刻意不收斂） | `components/brand-mark.tsx` |
| 入口頁 `loading` 時帳號卡整塊不畫（不顯示猜的權限狀態） | `app/hub-view.tsx` |
| `IconTile` 跟記帳本的 `IconAvatar` 同尺寸，兩邊清單並排看起來是同一套 | `components/ui.tsx` |

## 2026-11-18：刪帳號改成連所有工具的資料一起刪

原本 `deleteUserCascade` 只清 `transit.*`，記帳本 13 個 collection 整份留著變孤兒資料——
而確認視窗寫的是「在各工具底下存的資料也會一併刪除」。畫面承諾了什麼，程式就要真的做到。
同一輪把管理後台的刪除確認從 `window.confirm` 改成批次選取 ＋ 從底部升起的確認卡。

## 2026-11-28：補上設計系統文件

`docs/hub/design.md`，內容從 `app/globals.css` 的 `:root` 色票與 `components/ui.tsx` 的註解
整理出來。這一層以前沒有任何樣式文件，而它其實是**四套設計系統裡涵蓋最廣的一套**——入口、
登入、註冊、後台、無權限畫面，加上整個圖片壓縮工具都走這一套。

`docs/compress/design.md` 只有一段指路，寫明圖片壓縮沒有自己的色票、要改樣式去讀 hub 那份。
