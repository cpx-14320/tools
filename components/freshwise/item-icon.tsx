"use client";

import { useState } from "react";
import { FaIcon } from "./fa-icon";
import { colors } from "./theme";

/**
 * 品項／分類的圖示。**先試圖片，圖片不存在就退回 Font Awesome 的向量圖示。**
 *
 * 這樣設計是為了「圖還沒畫好就先把路徑接上」：`public/freshwise/items/FA1.png` 這些檔案
 * 目前還是空的，畫面上顯示的是向量圖示；把圖片丟進那個資料夾之後，不用改任何程式碼，
 * 那一項就自動換成圖片。
 *
 * 用 `<img>` ＋ `onError` 而不是搭乘車那邊的 CSS background-image 疊漸層：那套的退路是
 * 一塊漸層色塊（圖還沒上傳時看起來像色塊佔位），這裡希望退路是「看得懂是什麼菜」的向量
 * 圖示，所以需要真的知道圖片載入失敗了——`onError` 才給得出這個訊號。
 *
 * 不用 next/image：這些圖片是固定尺寸的小圖示（40px 內），next/image 的最佳化與 layout
 * 計算在這個尺寸沒有好處，還會多一層 wrapper 影響版面。
 */
export function ItemIcon({
  src,
  fallbackIcon,
  alt,
  size = 16,
  boxSize,
  color = colors.brand,
  className = "",
}: {
  /** 圖片路徑（見 lib/freshwise/catalog.ts 的 itemImage／categoryImage）。 */
  src: string;
  /** 圖片不存在時顯示的 Font Awesome 圖示名稱。 */
  fallbackIcon: string;
  alt: string;
  /** 圖示本身的尺寸。 */
  size?: number;
  /** 外框（淡綠底的圓角方塊）的尺寸。不給就不畫外框，只畫圖示。 */
  boxSize?: number;
  color?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const inner = failed ? (
    <FaIcon icon={fallbackIcon} size={size} className="" color={color} />
  ) : (
    // 不用 next/image：這些是 40px 以內的小圖示，最佳化在這個尺寸沒有好處（還會多一層
    // wrapper 影響版面），而且這裡需要 onError 才能在圖片還沒放進 public/ 時退回向量
    // 圖示，next/image 不給這個訊號。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      // 圖片本身是裝飾（旁邊一定有品名文字），所以 alt 留空、不重複讀一次名稱。
      // 載入失敗（檔案還沒放）就切到向量圖示。
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );

  if (!boxSize) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-label={alt} role="img">
        {inner}
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${className}`}
      style={{ width: boxSize, height: boxSize, backgroundColor: colors.surfaceSoft }}
      aria-label={alt}
      role="img"
    >
      {inner}
    </span>
  );
}
