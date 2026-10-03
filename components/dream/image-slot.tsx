"use client";

import { useState } from "react";

/** 圖片還沒給之前先用柔和漸層佔位，之後直接把 src 換成真的圖片路徑就會顯示真圖。
 *  路徑先指定好、檔案還沒上傳（404）時也會自動退回佔位，不會顯示壞掉的圖示。 */
export function ImageSlot({ src, alt, label, className = "" }: { src?: string; alt: string; label?: string; className?: string }) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`object-cover ${className}`} onError={() => setErrored(true)} />;
  }
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#E4DCFB] to-[#F6D9EE] text-[#9B8FD9] ${className}`}
    >
      <span aria-hidden className="text-lg">
        🖼️
      </span>
      {label && <span className="text-[10px] font-medium">{label}</span>}
    </div>
  );
}
