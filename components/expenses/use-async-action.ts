"use client";

import { useRef, useState } from "react";

/** 包住一個非同步動作，送出期間不接受第二次觸發。
 *
 *  **為什麼不能只用 state**：`setState` 要等重繪才生效，所以「手指快速連點兩下」那種
 *  同一個 tick 內的第二次點擊，用 `if (busy) return` 是擋不住的——那時候 `busy` 還是
 *  舊值。要用 ref 當真正的閘門，state 只負責讓按鈕看起來不能按。
 *
 *  `ModalFooter` 的儲存鍵本來就有這套，但那只涵蓋「走彈窗儲存」的路徑。刪除、確認、
 *  批次這些直接打 API 的按鈕各自散落在十幾個地方，收斂成這一個 hook 才不會漏掉一個。
 *
 *  用法：
 *  ```
 *  const del = useAsyncAction(handleDelete);
 *  <Button disabled={del.busy} onClick={del.run}>{del.busy ? "刪除中…" : "刪除"}</Button>
 *  ``` */
export function useAsyncAction<Args extends unknown[]>(action: (...args: Args) => void | Promise<unknown>) {
  const runningRef = useRef(false);
  const [busy, setBusy] = useState(false);

  async function run(...args: Args) {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      await action(...args);
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }

  return { run, busy };
}
