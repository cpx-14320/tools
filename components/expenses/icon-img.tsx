"use client";

import { useEffect, useState } from "react";

/** 記帳本的小圖示元件，做法比照搭乘車的 components/transit/icon-img.tsx（兩個工具刻意
 *  不共用元件，色票也各自獨立）。漸層色跟真圖網址寫在同一個 background-image 的逗號
 *  清單裡——inline style 的 background-image 會整個蓋掉 class 設的，不能分兩層疊；
 *  圖片還沒放進 public/expenses、404 時瀏覽器會自動退回清單裡的下一層（漸層色），
 *  不需要額外的 onError 處理。 */
export function IconImg({
  src,
  alt,
  size = 24,
  className = "",
  background = true,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  /** 已經是去背的真圖時關掉——不然圖片透明的地方會透出漸層色，看起來像圖示後面多一層底。 */
  background?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  // 這是 CSS background-image 不是 <img>，沒有原生 onLoad 可以掛；用一個不會進畫面的
  // Image() 在背後載同一張圖，不管成功或 404 都讓骨架消失，不會一直卡著。
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
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {!loaded && <span className="absolute inset-0 animate-pulse rounded-lg bg-[#EDE6FB]" />}
      <span
        role="img"
        aria-label={alt}
        className="absolute inset-0 rounded-lg bg-contain bg-center bg-no-repeat transition-opacity duration-200"
        style={{
          opacity: loaded ? 1 : 0,
          backgroundImage: background ? `url("${src}"), linear-gradient(to bottom right, #E8E9FF, #FFE3EB)` : `url("${src}")`,
        }}
      />
    </span>
  );
}
