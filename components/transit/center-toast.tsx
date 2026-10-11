"use client";

import { useEffect, useState } from "react";

// 停留＋淡出各自的時間：先讓文字完整停留 3 秒，使用者看得到、來得及反應，再花半秒淡出，
// 不是一到 3 秒就瞬間消失——「慢慢淡出」本身也是反饋的一部分，太突然會讓人覺得是閃一下
// 的錯誤訊息，不是「做成功了」的確認。
const HOLD_MS = 3000;
const FADE_MS = 500;

/** 畫面正中央的一次性成功提示——3 秒後自動淡出，不需要使用者手動關掉，也不會擋住底下
 *  的操作（pointer-events-none）。外殼（TransitMobileShell）的卡片容器本身有 transform，
 *  這裡的 fixed 會以卡片為定位基準、不是整個瀏覽器視窗，所以 inset-0 置中直接就是卡片
 *  正中央，不用額外處理寬螢幕時的置中問題，跟底部導覽列／回頂部按鈕是同一個理由。 */
export function CenterToast({ message, onDone }: { message: string; onDone: () => void }) {
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
        // 背景色跟首頁「搜尋OO班次」那顆按鈕同一個深紫色（#6F5FD6），不是另外配的深色調。
        className="rounded-2xl px-5 py-3.5 text-center text-sm font-medium text-white shadow-[0_12px_32px_-8px_rgba(111,95,214,0.5)] transition-opacity ease-out"
        style={{ background: "rgba(111,95,214,0.95)", opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {message}
      </div>
    </div>
  );
}
