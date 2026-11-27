# 圖片壓縮（compress）— 已完成紀錄

> 2026-11-27 建立。這個工具以前沒有獨立文件，決策都寫在
> `app/tools/compress/compress-view.tsx` 與 `lib/compress/image.ts` 的檔頭註解裡。
>
> 最重要的那一條（也是 [rules.md](rules.md) 的來源）：**全部在瀏覽器完成、沒有任何 API
> route**，所以這一頁沒有骨架、沒有樂觀更新、也沒有「存檔失敗要還原」那些問題。
>
> 往後做完一輪就往下疊一節。
