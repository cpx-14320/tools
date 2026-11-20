# 菜鳥不買貴的圖片

兩個資料夾，檔名都用「代碼 + .png」，不要用中文檔名（中文檔名在不同作業系統與編碼下
很容易出問題，代碼才是這個品項的穩定識別）。

| 資料夾 | 檔名 | 例子 |
| --- | --- | --- |
| `items/` | 品項代碼（見 `lib/freshwise/catalog.ts`） | `FA1.png`（甘藍）、`HB3.png`（白蝦） |
| `categories/` | 分類代碼 | `veg.png`、`fruit.png`、`seafood.png`、`meat.png`、`egg.png` |

建議尺寸 96×96 以上的正方形透明背景 PNG（畫面上最大用到 40px，留兩倍以上給高解析螢幕）。

**圖片還沒放進來之前，畫面會自動顯示 Font Awesome 的向量圖示**，不會破圖也不會有空洞；
把檔案丟進來之後不用改任何程式碼，重新整理就會換成圖片（見
`components/freshwise/item-icon.tsx`）。
