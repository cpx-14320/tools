import { itemArtwork } from "@/lib/freshwise/art-assets";
import { IllustratedArt, GameIcon, type GameIconName } from "./game-art";

// 品項圖示。**有畫好的插畫才畫，沒有的留白。**
//
// 以前沒有插畫時會退回「這個分類」的通用圖示，結果一整排新加的蔬菜長得一模一樣——
// 使用者看到五顆相同的葉子，分不出哪個是茼蒿哪個是芥菜，比留白更糟。留白至少誠實地
// 說「這一項還沒有圖」，而且一眼就看得出哪些還要補。
//
// 分類本身的圖示（`/freshwise/category-*.png`）不受影響，那是真的在畫「分類」。
//
// 待補的清單用 `npx tsx scripts/freshwise-missing-art.mts` 產出。

/** 從 `itemImage()` / `categoryImage()` 產生的路徑把 key 取回來。 */
const ITEM_CODE = /\/item-([A-Z0-9]+)\.png$/;
const CATEGORY_KEY = /\/category-([a-z]+)\.png$/;

export function ItemIcon({
  src,
  alt,
  size = 40,
  boxSize,
  className = "",
}: {
  src: string;
  /** @deprecated 留著是為了呼叫端不用一次全改；分類改從品項目錄查，這個值不再影響顯示。 */
  fallbackIcon?: string;
  alt: string;
  size?: number;
  boxSize?: number;
  className?: string;
}) {
  const code = ITEM_CODE.exec(src)?.[1];
  const art = code ? itemArtwork(code) : undefined;
  const categoryOfPath = CATEGORY_KEY.exec(src)?.[1] as GameIconName | undefined;
  const artSize = boxSize ?? size;
  return (
    <span className={`fw-item-art ${className}`} style={{ width: boxSize ?? artSize, height: boxSize ?? artSize }} role="img" aria-label={alt}>
      {art ? (
        <IllustratedArt src={art.file} size={artSize} />
      ) : categoryOfPath ? (
        <GameIcon name={categoryOfPath} size={artSize} />
      ) : null}
    </span>
  );
}
