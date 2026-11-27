import Image from "next/image";
import { cx } from "./theme";
import { PetInteraction, type PetReactionHandle } from "./pet-interaction";
import type { Ref } from "react";
import { COMPANIONS, type CompanionId } from "@/lib/freshwise/companions";
import { petBaseFile, type PetStage } from "@/lib/freshwise/pet-expressions";

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
export function PetArtwork({ id = "cabbage", size = 160, className = "", priority = false, interactive = false, ready = true, reactionRef, stage = 1 }: { id?: CompanionId; size?: number; className?: string; priority?: boolean; interactive?: boolean; ready?: boolean; reactionRef?: Ref<PetReactionHandle>; /** 要畫第幾階。由呼叫端用 petLookStage(state, id) 算好傳進來——等級與「使用者自己挑的樣子」都在那裡解決，這個元件只管畫。 */ stage?: PetStage }) {
  return (
    <span className={cx("fw-pet-art", className)} style={{ width: size, height: size }} aria-busy={ready ? undefined : true} data-pet-stage={stage}>
      {!ready ? null : interactive ? <PetInteraction key={`${id}-${stage}`} id={id} name={petName(id)} stage={stage} size={size} priority={priority} reactionRef={reactionRef}/> : <Image src={petBaseFile(id, stage)} alt={petName(id)} fill sizes={`${size}px`} priority={priority} />}
    </span>
  );
}

/**
 * 某一隻夥伴、某一階的平常樣子。圖鑑用它把三個成長階段並排出來。
 *
 * 用 IllustratedArt（CSS 背景）而不是 next/image：圖鑑一次最多畫 3 階 × 已結識的夥伴，
 * 尺寸只有 60～76px，走最佳化反而多一輪請求。檔案已經是 640px 的輕量 webp。
 */
export function PetStageArtwork({ id, stage, size = 72, className = "" }: { id: CompanionId; stage: PetStage; size?: number; className?: string }) {
  return <IllustratedArt src={petBaseFile(id, stage)} size={size} className={className} />;
}

/** 三片切片（左／中／右）組成一條可伸縮的框。素材一律是 webp——`format` 參數已經拿掉，
 *  因為 public/freshwise 底下的圖全部是 webp 了。 */
export function SlicedArtwork({name,className=""}:{name:string;className?:string}) {
  return <span className={cx("fw-sliced-art", className)} aria-hidden="true"><span className="fw-sliced-cap" style={{backgroundImage:`url(/freshwise/${name}-left.webp)`}}/><span className="fw-sliced-middle" style={{backgroundImage:`url(/freshwise/${name}-middle.webp)`}}/><span className="fw-sliced-cap" style={{backgroundImage:`url(/freshwise/${name}-right.webp)`}}/></span>;
}
