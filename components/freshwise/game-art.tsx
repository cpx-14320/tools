import Image from "next/image";
import { cx } from "./theme";
import { PetInteraction, type PetReactionHandle } from "./pet-interaction";
import type { CSSProperties, Ref } from "react";
import { COMPANIONS, type CompanionId } from "@/lib/freshwise/companions";
import { petBaseFile, petStage } from "@/lib/freshwise/pet-expressions";

// 插畫素材的進入點。插畫只負責圖案，文字與可點選狀態一律由 HTML 提供，所以這裡畫出來
// 的都是 `aria-hidden` 的裝飾層或帶 `aria-label` 的 img role，不會有只存在於圖片裡的資訊。
//
// 素材全部平放在 `public/freshwise/` 同一層（比照 components/expenses 的 public/expenses），
// 用檔名前綴分類：`ui-*` 是介面圖示、`item-*` 是品項、`pet-*` 是夥伴。沒有在用的素材收在
// `public/freshwise/unused/`，不要從那裡引用。

/** 無文字原創插畫；檔名固定為 `/freshwise/ui-<name>.webp`。 */
export const GAME_ICONS = ["home", "market", "companions", "basket", "settings", "dew", "veg", "fruit", "seafood", "meat", "egg", "grain", "search", "filter", "seed", "water", "play", "letter", "book", "pencil", "leaf", "calendar", "chart", "notice"] as const;
export type GameIconName = (typeof GAME_ICONS)[number];

/** 獨立透明圖。用背景圖而不是 <img>，是為了讓尺寸由呼叫端決定、不受原圖比例影響。 */
export function IllustratedArt({ src, size, className = "" }: { src: string; size: number; className?: string }) {
  return (
    <span
      className={cx("fw-art", className)}
      aria-hidden="true"
      style={{ width: size, height: size, backgroundImage: `url(${src})`, backgroundSize: "contain", backgroundPosition: "center" }}
    />
  );
}

export function GameIcon({ name, size = 32, className = "" }: { name: GameIconName; size?: number; className?: string }) {
  return <IllustratedArt src={`/freshwise/ui-${name}.webp${name === "leaf" || name === "calendar" ? "?v=8" : ""}`} size={size} className={cx(name === "leaf" && "fw-leaf-art", className)} />;
}

function petName(id: CompanionId): string {
  return (COMPANIONS.find((p) => p.id === id) ?? COMPANIONS[0]).name;
}

/**
 * 主角夥伴（首頁花園、夥伴頁、菜籃、小紙條）。
 *
 * `ready`：夥伴進度是從 API 讀的，讀回來之前 store 裡的 `active` 是預設值（高麗菜糰糰）。
 * 直接畫下去的話，選了別隻的人每次進頁面都會先看到糰糰、再「啪」地換成自己的夥伴。
 * 傳 `ready={false}` 就只佔位不畫圖——同樣的尺寸，所以換上來的時候版面不會跳。
 */
export function PetArtwork({ id = "cabbage", size = 160, className = "", priority = false, interactive = false, ready = true, reactionRef, level = 1 }: { id?: CompanionId; size?: number; className?: string; priority?: boolean; interactive?: boolean; ready?: boolean; reactionRef?: Ref<PetReactionHandle>; level?: number }) {
  return (
    <span className={cx("fw-pet-art", className)} style={{ width: size, height: size }} aria-busy={ready ? undefined : true} data-pet-stage={petStage(id, level)}>
      {!ready ? null : interactive ? <PetInteraction key={id} id={id} name={petName(id)} level={level} size={size} priority={priority} reactionRef={reactionRef}/> : <Image src={petBaseFile(id, level)} alt={petName(id)} fill sizes={`${size}px`} priority={priority} />}
    </span>
  );
}

/** 圖集的一格。六位夥伴的圖鑑姿勢畫在同一張 3×2 的圖上，用背景位置取格。 */
const COLLECTION_ATLAS = { src: "/freshwise/collection-companion-atlas.webp", columns: 3, rows: 2 };

function AtlasArt({ src, index, columns, rows, size, label, className = "" }: { src: string; index: number; columns: number; rows: number; size: number; label?: string; className?: string }) {
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundImage: `url(${src})`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${((index % columns) / (columns - 1)) * 100}% ${(Math.floor(index / columns) / (rows - 1)) * 100}%`,
  };
  return <span className={cx("fw-art", className)} style={style} role="img" aria-label={label} />;
}

/** 蔬果圖鑑格子裡的小夥伴（圖集的格位順序＝COMPANIONS 的順序，不要重排那份陣列）。 */
export function CollectionArtwork({ id, size = 76, className = "" }: { id: CompanionId; size?: number; className?: string }) {
  return <AtlasArt {...COLLECTION_ATLAS} index={COMPANIONS.findIndex((p) => p.id === id)} size={size} label={petName(id)} className={className} />;
}

/** 左右端維持比例，中間材質重複延伸的裝飾圖片層。 */
/** 三片切片（左／中／右）組成一條可伸縮的框。素材一律是 webp——`format` 參數已經拿掉，
 *  因為 public/freshwise 底下的圖全部是 webp 了。 */
export function SlicedArtwork({name,className=""}:{name:string;className?:string}) {
  return <span className={cx("fw-sliced-art", className)} aria-hidden="true"><span className="fw-sliced-cap" style={{backgroundImage:`url(/freshwise/${name}-left.webp)`}}/><span className="fw-sliced-middle" style={{backgroundImage:`url(/freshwise/${name}-middle.webp)`}}/><span className="fw-sliced-cap" style={{backgroundImage:`url(/freshwise/${name}-right.webp)`}}/></span>;
}
