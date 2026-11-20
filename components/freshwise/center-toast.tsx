"use client";

import { useEffect, useState } from "react";

// 停留＋淡出各自的時間：先讓文字完整停留 2.4 秒（看得到、來得及反應），再花半秒淡出。
// 不是一到時間就瞬間消失——「慢慢淡出」本身也是反饋的一部分，太突然會讓人以為是閃一下
// 的錯誤訊息，不是「做成功了」的確認。
const HOLD_MS = 2400;
const FADE_MS = 500;

/** 畫面正中央的一次性提示（已加入菜籃／已移除／儲存成功）。時間到自動淡出，不需要使用者
 *  手動關，也不會擋住底下的操作（pointer-events-none）。
 *
 *  外層手機框容器本身有 transform，所以這裡的 fixed 是以卡片為定位基準、不是瀏覽器視窗，
 *  inset-0 置中就是卡片正中央，寬螢幕時不用額外處理置中。 */
export function CenterToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 掛載當下先透明，下一個 frame 才切成不透明，CSS transition 才有起點可以過渡。
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
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center px-10">
      <div
        className="rounded-2xl px-5 py-3.5 text-center text-sm font-medium text-white shadow-[0_12px_32px_-8px_rgba(47,127,85,0.5)] transition-opacity ease-out"
        style={{ background: "rgba(60,154,98,0.95)", opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
      >
        {message}
      </div>
    </div>
  );
}
