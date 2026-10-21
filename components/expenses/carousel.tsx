"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** 卡片之間的間距（px）——拖曳切換時中間會露出這段背景，不會兩張卡緊貼在一起；平移距離
 *  要連這段間距一起算進去（見下面 translateX 的 calc），不然切換後會對不齊容器邊緣。 */
const CARD_GAP_PX = 12;

/** 要滑多遠才算「換一張」——不到這個比例就彈回原本那張。 */
const SWIPE_THRESHOLD_RATIO = 0.2;

/** 可左右滑動的卡片輪播，下方有圓點指示目前在第幾張。
 *
 *  做法比照搭乘車首頁的天氣輪播：自己用 pointer 事件算位移，不是單靠 CSS scroll-snap——
 *  scroll-snap 只有觸控裝置的原生滑動手勢會動，桌面用滑鼠拖曳不會觸發捲動，等於桌面上
 *  完全沒反應。改用 translateX 自己算，滑鼠拖曳跟手指觸控走同一套邏輯；放手時依拖曳距離
 *  決定留在原張還是換張，再補一個過渡動畫歸位。
 *
 *  圓點除了指示位置，也是在告訴使用者「這裡可以滑」——只有一張時就不顯示，免得出現一顆
 *  點不出來要幹嘛。 */
export function Carousel({ slides, className = "" }: { slides: ReactNode[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);

  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (slides.length < 2) return;
    dragStartX.current = e.clientX;
    setDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragOffset(e.clientX - dragStartX.current);
  }

  function endDrag() {
    if (!dragging) return;
    const width = containerRef.current?.clientWidth ?? 1;
    const threshold = width * SWIPE_THRESHOLD_RATIO;
    if (dragOffset <= -threshold) setIndex((i) => Math.min(slides.length - 1, i + 1));
    else if (dragOffset >= threshold) setIndex((i) => Math.max(0, i - 1));
    setDragOffset(0);
    setDragging(false);
  }

  if (slides.length === 0) return null;

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="touch-pan-y select-none overflow-hidden"
        style={{ cursor: slides.length > 1 ? (dragging ? "grabbing" : "grab") : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="flex"
          style={{
            gap: CARD_GAP_PX,
            transform: `translateX(calc(${-safeIndex * 100}% + ${-safeIndex * CARD_GAP_PX}px + ${dragOffset}px))`,
            transition: dragging ? "none" : "transform 280ms ease",
          }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="w-full shrink-0">
              {slide}
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`第 ${i + 1} 張`}
              aria-current={i === safeIndex}
              className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-4 bg-[#6F5FD6]" : "w-1.5 bg-[#D8CFF2]"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
