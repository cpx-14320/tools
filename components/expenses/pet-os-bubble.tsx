"use client";

import { useEffect, useState } from "react";

/** 一句話完全不透明地停留多久。**不含**前後的淡入淡出，所以一輪實際是
 *  HOLD_MS + FADE_MS × 2。 */
const HOLD_MS = 15000;
/** 淡出 → 換字 → 淡入的單程時間。 */
const FADE_MS = 400;

/** 首頁主視覺上那顆對話框——角色的消費心理 OS。
 *
 *  句子由 lib/expenses/pet-os.ts 依近 7 日的收支狀況挑好、洗好順序後傳進來，這裡只負責
 *  「停留 HOLD_MS 之後換下一句，而且用淡出淡入換」。
 *
 *  換字的順序是：先把透明度降到 0（等 FADE_MS）→ 換成下一句 → 再升回 1。如果直接換字
 *  再淡入，舊句子會在不透明的狀態下被新句子取代，等於還是硬切，淡入只是多了一層。
 *
 *  只有一句話時不啟動計時器：那種情況轉場只會讓同一句話自己閃一下。 */
export function PetOsBubble({ lines, className = "" }: { lines: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length < 2) return;
    const hold = setTimeout(() => {
      setVisible(false);
      const swap = setTimeout(() => {
        setIndex((i) => (i + 1) % lines.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(swap);
    }, HOLD_MS);
    return () => clearTimeout(hold);
    // index 進 deps：每換一句就重新排下一次的計時，不用 setInterval（那個在分頁被
    // 切到背景再回來時容易一次補跑好幾輪）。
  }, [index, lines.length]);

  if (lines.length === 0) return null;

  return (
    // 整顆框在主視覺裡水平置中，但**框裡的字靠左**：句子換到第二行時，置中會讓兩行
    // 的左緣對不齊，讀起來像標語不像在講話。
    <div className={`pointer-events-none mx-auto w-fit max-w-[260px] ${className}`}>
      <div className="relative rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_4px_16px_-4px_rgba(74,59,124,0.35)]">
        <p
          // leading-snug（1.375）而不是 leading-relaxed（1.625）：行高的「半行距」會平均加
          // 在整塊文字的上下兩端，1.625 時上下各多出 4.4px，跟 10px 的 padding 疊起來變成
          // 14.4px，比左右的 14px padding 還厚一點，整塊字看起來就浮在框中間偏上。中文字
          // 的墨水本來就落在 em 框偏上的位置，這個誤差會被放大成「上下不一樣」。
          //
          // 不用 line-height: normal（Tailwind 寫成 leading-[normal]）是因為那個值由字體
          // 的 ascent/descent 決定，換一套字體就變；而且兩行時行間會太擠。1.375 是「外緣
          // 貼合、行間還讀得開」的折衷，而且是固定比例，跨字體結果一致。
          className="text-sm font-medium leading-snug text-[#4A3B7C] transition-opacity duration-[400ms]"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {lines[index]}
        </p>
        {/* 對話框的小尾巴。框置中之後尾巴也擺中間，正好落在角色頭頂上方。用一個旋轉
            45 度的方塊接在底緣，跟框同一個底色才看不出接縫。 */}
        <span className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-[3px] bg-white" />
      </div>
    </div>
  );
}
