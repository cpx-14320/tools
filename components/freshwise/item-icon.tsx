import {itemArtwork} from "@/lib/freshwise/art-assets";
import {IllustratedArt,GameIcon,type GameIconName} from "./game-art";
const CATEGORY:Record<string,GameIconName>={carrot:"veg",leaf:"veg",seedling:"veg",circle:"veg",lemon:"veg","pepper-hot":"veg","apple-whole":"fruit",fish:"seafood",shrimp:"seafood","drumstick-bite":"meat",egg:"egg","wheat-awn":"grain"};
/** 每一格對應有行情來源的實際品項，圖集清單保存於素材索引。 */
export function ItemIcon({src,fallbackIcon,alt,size=40,boxSize,className=""}:{src:string;fallbackIcon:string;alt:string;size?:number;boxSize?:number;color?:string;className?:string}){
 const code=/\/items\/([A-Z0-9]+)\.png$/.exec(src)?.[1];
 const art=code?itemArtwork(code):undefined;
 const category=/\/categories\/([a-z]+)\.png$/.exec(src)?.[1] as GameIconName|undefined;
 const artSize=Math.min(40,Math.max(size,boxSize??32));
 return <span className={`fw-item-art ${className}`} style={{width:boxSize??artSize,height:boxSize??artSize}} role="img" aria-label={alt}>
 {art?<IllustratedArt src={art.file} size={artSize}/>:<GameIcon name={category??CATEGORY[fallbackIcon]??"veg"} size={artSize}/>}</span>;
}
