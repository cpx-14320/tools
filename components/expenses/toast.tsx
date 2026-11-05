"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// 停留＋淡出各自的時間：先讓文字完整停留 3 秒，使用者看得到、來得及反應，再花半秒淡出，
// 不是一到 3 秒就瞬間消失——「慢慢淡出」本身也是反饋的一部分，太突然會讓人覺得是閃一下
// 的錯誤訊息，不是「做成功了」的確認。數值比照搭乘車的 CenterToast。
const HOLD_MS = 3000;
const FADE_MS = 500;
/** 帶「復原」的提示要停久一點：使用者得先讀懂發生什麼事，才來得及決定要不要復原。
 *  3 秒對「我剛剛是不是按錯了」這種念頭來說太短。 */
const HOLD_MS_WITH_ACTION = 6000;

/** 畫面正中央的一次性提示——3 秒後自動淡出，不需要使用者手動關掉，也不會擋住底下的操作
 *  （pointer-events-none）。外殼（ExpensesMobileShell）的卡片容器本身有 transform，
 *  這裡的 fixed 會以卡片為定位基準、不是整個瀏覽器視窗，所以 inset-0 置中直接就是卡片
 *  正中央，不用額外處理寬螢幕時的置中問題，跟底部導覽列是同一個理由。
 *
 *  做法跟長相比照搭乘車的 components/transit/center-toast.tsx，但照記帳本的慣例各自
 *  維護一份、不共用（見 expenses-mobile-shell.tsx 開頭的說明）。 */
function CenterToast({ message, action, onDone }: { message: string; action?: ToastAction; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const hold = action ? HOLD_MS_WITH_ACTION : HOLD_MS;

  useEffect(() => {
    // 掛載當下先是透明，下一個 frame 才切成不透明，CSS transition 才有「淡入」的起點可以
    // 從，不然一掛載就是最終狀態，opacity 的 transition 不會有任何過渡效果。
    const raf = requestAnimationFrame(() => setVisible(true));
    const fadeOutTimer = setTimeout(() => setVisible(false), hold);
    const removeTimer = setTimeout(onDone, hold + FADE_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeOutTimer);
      clearTimeout(removeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // 整層 pointer-events-none 讓提示不擋住底下的操作；有「復原」時那顆按鈕要自己把
    // 事件收回來（pointer-events-auto），不然點不到。
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-10">
      <div
        className="flex items-center gap-3 rounded-2xl px-5 py-3.5 text-center text-sm font-medium text-white shadow-[0_12px_32px_-8px_rgba(111,95,214,0.5)] transition-opacity ease-out"
        style={{ background: "rgba(111,95,214,0.95)", opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        <span>{message}</span>
        {action && (
          <button
            type="button"
            className="pointer-events-auto shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold"
            onClick={() => {
              action.onAction();
              onDone();
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

/** 提示上那顆可以按的按鈕（目前只有刪除後的「復原」）。 */
export interface ToastAction {
  label: string;
  onAction: () => void;
}

const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null);

/** 提示訊息放在外殼這一層（見 expenses-shell.tsx），不是每個頁面自己擺一份 state ＋
 *  一個 <CenterToast>：記帳本幾乎每一頁都有新增／刪除，照搭乘車那種「每個 view 自己
 *  管」的寫法要複製十幾次同樣的三行。放在外殼還有一個好處——刪掉一筆之後換頁
 *  （帳戶明細刪掉帳戶會跳回資產總表）時提示不會跟著頁面一起被卸載。
 *
 *  `key` 跟著訊息序號換，所以連續兩次同樣的訊息（連刪兩筆）會重新計時，不是沿用上一次
 *  已經快要淡出的那顆。 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; action?: ToastAction } | null>(null);
  const show = useCallback((message: string, action?: ToastAction) => setToast({ id: Date.now(), message, action }), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <CenterToast key={toast.id} message={toast.message} action={toast.action} onDone={() => setToast(null)} />}
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

export function useToast(): (message: string, action?: ToastAction) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}
