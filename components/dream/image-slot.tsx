"use client";

import { useEffect, useRef, useState } from "react";

/** 圖片還沒給之前先用柔和漸層佔位，之後直接把 src 換成真的圖片路徑就會顯示真圖。
 *  路徑先指定好、檔案還沒上傳（404）時也會自動退回佔位，不會顯示壞掉的圖示。瀏覽器真的
 *  在下載／解碼這張圖的期間（尤其是第一次沒有快取時），img 標籤本身在載完之前是空的，
 *  這裡額外疊一層骨架佔住版面，load 完才讓圖片淡入，不會讓使用者看到一塊空白。 */
export function ImageSlot({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 圖片已經被瀏覽器快取過的話，<img> 的 onload 事件可能在 React 把 onLoad 這個 handler
  // 接上去之前就已經先觸發完了，state 永遠不會被設成 true，骨架就卡住蓋著圖片不會消失。
  // 這裡額外用 .complete 補一次檢查，不管是不是快取都能正確翻成已載入。
  useEffect(() => {
    // 跟 weather-carousel.tsx 的 useCityWeather 同一種例外：這裡是同步讀「瀏覽器 img
    // 元素當下的 .complete 狀態」這個外部狀態，不是在訂閱事件、也不會連鎖觸發其他 effect。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoaded(false);
    if (imgRef.current?.complete) setLoaded(true);
  }, [src]);

  if (src && !errored) {
    // 外層容器要是「非 static」定位才能讓裡面蓋著的骨架 absolute 貼齊；呼叫端如果已經自己
    // 帶了 absolute（背景圖鋪滿整個父層那種用法）就不用再加 relative——同一層疊兩個定位
    // 方式的 class，Tailwind 最後套用哪一個是看生成 CSS 的順序，不是看 class 字串的順序，
    // 不能保證外面給的 absolute 一定贏。
    const positioned = className.includes("absolute") ? "" : "relative";
    return (
      <div className={`${positioned} overflow-hidden ${className}`}>
        {!loaded && <div className="absolute inset-0 animate-pulse bg-[#E4DBF9]" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>
    );
  }
  return <div aria-label={alt} className={`bg-gradient-to-br from-[#E4DCFB] to-[#F6D9EE] ${className}`} />;
}
