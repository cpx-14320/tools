"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// 停留＋淡出各自的時間：先讓文字完整停留 3 秒，使用者看得到、來得及反應，再花半秒淡出，
// 不是一到 3 秒就瞬間消失——「慢慢淡出」本身也是反饋的一部分，太突然會讓人覺得是閃一下
// 的錯誤訊息，不是「做成功了」的確認。數值比照搭乘車的 CenterToast。
const HOLD_MS = 3000;
const FADE_MS = 500;

/** 畫面正中央的一次性提示——3 秒後自動淡出，不需要使用者手動關掉，也不會擋住底下的操作
 *  （pointer-events-none）。外殼（ExpensesMobileShell）的卡片容器本身有 transform，
 *  這裡的 fixed 會以卡片為定位基準、不是整個瀏覽器視窗，所以 inset-0 置中直接就是卡片
 *  正中央，不用額外處理寬螢幕時的置中問題，跟底部導覽列是同一個理由。
 *
 *  做法跟長相比照搭乘車的 components/transit/center-toast.tsx，但照記帳本的慣例各自
 *  維護一份、不共用（見 expenses-mobile-shell.tsx 開頭的說明）。 */
function CenterToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 掛載當下先是透明，下一個 frame 才切成不透明，CSS transition 才有「淡入」的起點可以
    // 從，不然一掛載就是最終狀態，opacity 的 transition 不會有任何過渡效果。
    const raf = requestAnimationFrame(() => setVisible(true));
    const fadeOutTimer = setTimeout(() => setVisible(false), HOLD_MS);
    const removeTimer = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeOutTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-10">
      <div
        className="rounded-2xl px-5 py-3.5 text-center text-sm font-medium text-white shadow-[0_12px_32px_-8px_rgba(111,95,214,0.5)] transition-opacity ease-out"
        style={{ background: "rgba(111,95,214,0.95)", opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {message}
      </div>
    </div>
  );
}

const ToastContext = createContext<((message: string) => void) | null>(null);

/** 提示訊息放在外殼這一層（見 expenses-shell.tsx），不是每個頁面自己擺一份 state ＋
 *  一個 <CenterToast>：記帳本幾乎每一頁都有新增／刪除，照搭乘車那種「每個 view 自己
 *  管」的寫法要複製十幾次同樣的三行。放在外殼還有一個好處——刪掉一筆之後換頁
 *  （帳戶明細刪掉帳戶會跳回資產總表）時提示不會跟著頁面一起被卸載。
 *
 *  `key` 跟著訊息序號換，所以連續兩次同樣的訊息（連刪兩筆）會重新計時，不是沿用上一次
 *  已經快要淡出的那顆。 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const show = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <CenterToast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

/** 常用的三句話集中在這裡，避免同一件事在十幾個檔案裡寫成「新增成功」「已新增」
 *  「新增完成」三種說法。 */
export const TOAST = {
  created: "新增成功",
  saved: "儲存成功",
  deleted: "刪除成功",
} as const;

export function useToast(): (message: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}
