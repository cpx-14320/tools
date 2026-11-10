"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { BusyOverlay } from "./busy-overlay";

/** 「處理中」遮罩的共用入口。
 *
 *  **為什麼要做成 provider 而不是每頁自己一份 state**：會跑一陣子的操作散在十幾個地方
 *  （每一頁的刪除、批次改帳戶、批次改分類、存檔…），每個都要自己配一個 busy state、
 *  自己擺一個 BusyOverlay，漏掉一個就是那一條路徑按下去完全沒反應。收斂成一個 hook，
 *  呼叫端只要把原本的 async 函式包起來。
 *
 *  用法：
 *  ```
 *  const runBusy = useBusy();
 *  await runBusy("刪除中…", () => performDelete(ids));
 *  ```
 *
 *  巢狀呼叫用計數而不是布林值：批次操作裡面又呼叫了另一個包過的函式時，內層結束不該
 *  把外層的遮罩也關掉。 */
const BusyContext = createContext<(<T>(label: string, fn: () => Promise<T>) => Promise<T>) | null>(null);

export function BusyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ count: number; label: string }>({ count: 0, label: "處理中…" });
  // 計數放 ref：同一個 tick 內連續開始兩件事時，setState 還沒重繪，讀 state 會拿到舊值。
  const countRef = useRef(0);

  const runBusy = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    countRef.current += 1;
    setState({ count: countRef.current, label });
    try {
      return await fn();
    } finally {
      countRef.current -= 1;
      // label 留著上一次的：收掉的瞬間 open 已經是 false，換成預設字只會讓淡出時閃一下。
      setState((prev) => ({ count: countRef.current, label: prev.label }));
    }
  }, []);

  return (
    <BusyContext.Provider value={runBusy}>
      {children}
      <BusyOverlay open={state.count > 0} label={state.label} />
    </BusyContext.Provider>
  );
}

/** 包住一個會跑一陣子的動作，期間蓋上「處理中」遮罩。
 *
 *  不在 provider 底下時（例如單元測試或別的工具頁）就只是原樣執行，不會爆掉——這東西
 *  是體驗上的附加，不該變成元件只能活在特定 provider 裡的硬性相依。 */
export function useBusy() {
  const ctx = useContext(BusyContext);
  return ctx ?? (async <T,>(_label: string, fn: () => Promise<T>) => fn());
}
