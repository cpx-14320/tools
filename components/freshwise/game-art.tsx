import Image from "next/image";
import type { CSSProperties } from "react";
import { COMPANIONS, type CompanionId } from "@/lib/freshwise/companions";

/** 無文字原創插畫圖集；欄位與檔名固定，文字及可點選狀態仍由 HTML 提供。 */
export const GAME_ICONS = ["home", "market", "companions", "basket", "settings", "dew", "veg", "fruit", "seafood", "meat", "egg", "grain", "search", "filter", "seed", "water", "play", "letter", "book", "pencil", "leaf", "calendar", "chart", "notice"] as const;
export type GameIconName = typeof GAME_ICONS[number];
export function AtlasArt({ src, index, columns, rows, size, label, className = "" }: { src: string; index: number; columns: number; rows: number; size: number; label?: string; className?: string }) {
  const style: CSSProperties = { width: size, height: size, backgroundImage: `url(${src})`, backgroundSize: `${columns * 100}% ${rows * 100}%`, backgroundPosition: `${(index % columns) / (columns - 1) * 100}% ${Math.floor(index / columns) / (rows - 1) * 100}%` };
  return <span className={`fw-art ${className}`} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
/** 獨立透明圖，避免小圖示受圖集格位及鄰格干擾。 */
export function IllustratedArt({src,size,className=""}:{src:string;size:number;className?:string}) {
  return <span className={`fw-art ${className}`} aria-hidden="true" style={{width:size,height:size,backgroundImage:`url(${src})`,backgroundSize:"contain",backgroundPosition:"center"}} />;
}
export function GameIcon({ name, size = 32, className = "" }: { name: GameIconName; size?: number; className?: string }) {
  return <IllustratedArt src={`/freshwise/ui/simple/ui-${name}.png`} size={size} className={className} />;
}
const PET_FILES: Record<CompanionId, string> = { cabbage: "pet-cabbage-tuantuan.png", radish: "pet-radish-bengbeng.png", strawberry: "pet-strawberry-jiujiu.png", pumpkin: "pet-pumpkin-manman.png", eggplant: "pet-eggplant-bobo.png", corn: "pet-corn-nuannuan.png" };
export function PetArtwork({ id = "cabbage", size = 160, className = "", priority = false }: { id?: CompanionId; size?: number; className?: string; priority?: boolean }) {
  const pet = COMPANIONS.find((p) => p.id === id) ?? COMPANIONS[0];
  const file = PET_FILES[id];
  if (!file) return <AtlasArt src="/freshwise/companions/collection-companion-atlas.png" index={COMPANIONS.findIndex((p) => p.id === id)} columns={3} rows={2} size={size} label={pet.name} className={className} />;
  return <span className={`fw-pet-art ${className}`} style={{ width: size, height: size }}><Image src={`/freshwise/companions/${file}`} alt={pet.name} fill sizes={`${size}px`} priority={priority} /></span>;
}
export function CollectionArtwork({ id, size = 76, className = "" }: { id: CompanionId; size?: number; className?: string }) {
  return <AtlasArt src="/freshwise/companions/collection-companion-atlas.png" index={COMPANIONS.findIndex((p) => p.id === id)} columns={3} rows={2} size={size} label={COMPANIONS.find((p) => p.id === id)?.name} className={className} />;
}
