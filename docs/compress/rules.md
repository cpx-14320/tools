# 圖片壓縮（compress）— 規則與執行規範

> 2026-11-27 建立。這是五個工具裡最小的一個（`app/tools/compress` ＋ `lib/compress`
> 共約 1,240 行），規則也最少。跨工具共通的規則在 [../README.md](../README.md)。

## 0. 這個工具要解決什麼

把照片、截圖壓到夠小再存下來。**圖片不會離開使用者的裝置**——這句話是這個工具的賣點，
也是所有技術決定的來源。

## 1. 沒有任何 API route

壓縮是瀏覽器自己做的（`lib/compress/image.ts`，Canvas ／ `createImageBitmap`），打包走
`lib/compress/zip.ts`。所以這個工具**沒有**：

- loading 骨架（沒有等伺服器的時刻）
- 樂觀更新（沒有要跟伺服器對帳的狀態）
- 「存檔失敗要還原」那一類錯誤處理
- 任何 Mongo collection

**不要為了加功能而開一條 API route。** 一旦圖片上傳到伺服器，「圖片不會離開你的裝置」就不
成立了，那是這個工具唯一的承諾。需要伺服器才能做的事（例如 AVIF 編碼、超大檔分段處理），
要先回答「使用者願意把照片傳上來嗎」。

## 2. 樣式

走 `components/ui.tsx` ＋ `globals.css` 的那套（跟入口頁、登入、後台同一套），
**不是**三個工具各自的 `theme.ts`。這個工具只有一頁，不值得為它開第四套設計系統。
色票與元件見 [../hub/design.md](../hub/design.md)（本地的 [design.md](design.md) 只是指路）。

## 3. 怎麼驗

沒有腳本，也不需要——沒有伺服器邏輯可測。驗證方式是開瀏覽器實際壓幾張圖，確認：

```
npx tsc --noEmit
npx eslint app components lib
```

然後人工檢查：大檔（>10MB）、長圖、透明 PNG、HEIC（iPhone 拍的）、一次選很多張。
這幾種是會出問題的輸入。
