"use client";

import { useEffect, useState } from "react";

/** 給文字行內、小尺寸（搜尋框圖示、導覽列圖示等）用的小圖示佔位，不適合用 ImageSlot 那種
 *  大面積佔位框。漸層色跟真圖網址要寫在同一個 background-image 的逗號清單裡（不能分開用
 *  Tailwind 的 bg-gradient class + inline url 疊圖——inline style 的 background-image 會
 *  整個覆蓋掉 class 設的 background-image，不是疊加），圖片還沒上傳、404 時瀏覽器才會自動
 *  退回畫清單裡的下一層（漸層色），不需要額外的 onError 判斷。 */
export function IconImg({
  src,
  alt,
  size = 16,
  className = "",
  background = true,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  /** 已經有真圖、不需要漸層佔位墊底時關掉（例如底部導覽列）——不然圖片本身透明的地方
   *  會透出漸層色，看起來像圖示後面多一層顏色底。 */
  background?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  // 這裡是 CSS background-image，不是 <img> 標籤，沒有天生的 onLoad 事件可以掛；用一個
  // 不會插進畫面的 Image() 物件在背後載入同一張圖，載完（或失敗，例如 404 退回漸層）都讓
  // 骨架消失，不會一直卡住。
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoaded(false);
    const preload = new Image();
    preload.onload = () => {
      if (!cancelled) setLoaded(true);
    };
    preload.onerror = () => {
      if (!cancelled) setLoaded(true);
    };
    preload.src = src;
    if (preload.complete) setLoaded(true);
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    // 外層帶呼叫端傳進來的 className（例如導覽列未選中分頁的 opacity-50）、內層另外用
    // inline style 控制「圖片載完了沒」的淡入——兩層疊起來效果是相乘的，不會因為兩個
    // opacity 的 class／style 互相覆蓋掉彼此。
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {!loaded && <span className="absolute inset-0 animate-pulse rounded-[3px] bg-[#E4DBF9]" />}
      <span
        role="img"
        aria-label={alt}
        className="absolute inset-0 rounded-[3px] bg-cover bg-center transition-opacity duration-200"
        style={{
          opacity: loaded ? 1 : 0,
          backgroundImage: background ? `url("${src}"), linear-gradient(to bottom right, #E4DCFB, #F6D9EE)` : `url("${src}")`,
        }}
      />
    </span>
  );
}
