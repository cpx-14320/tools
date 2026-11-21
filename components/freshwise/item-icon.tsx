import { itemArtwork } from "@/lib/freshwise/art-assets";
import { findItem } from "@/lib/freshwise/catalog";
import { IllustratedArt, GameIcon, type GameIconName } from "./game-art";

// 品項圖示。有畫好的插畫就用插畫，沒有的退回「這個分類」的通用圖示。
//
// 退路一定要看品項自己的 `category`，**不要看 Font Awesome 的 icon 名稱**——icon 名稱
// 本來就跨分類共用（`apple-whole`、`lemon`、`wheat-awn` 都同時出現在兩個分類裡），以前
// 用 icon 名稱查表，`bacon` 沒在表裡就落到預設值 veg，於是「牛肉火鍋片」在菜籃裡顯示
// 一顆高麗菜。分類的 key（veg/fruit/seafood/meat/egg/grain）跟插畫圖示同名，直接對得上。

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
  const categoryOfItem = code ? (findItem(code)?.category as GameIconName | undefined) : undefined;
  const artSize = Math.min(40, Math.max(size, boxSize ?? 32));
  return (
    <span className={`fw-item-art ${className}`} style={{ width: boxSize ?? artSize, height: boxSize ?? artSize }} role="img" aria-label={alt}>
      {art ? <IllustratedArt src={art.file} size={artSize} /> : <GameIcon name={categoryOfPath ?? categoryOfItem ?? "veg"} size={artSize} />}
    </span>
  );
}
