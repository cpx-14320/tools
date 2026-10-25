import { IconLink } from "./icon-button";

/** 返回上一層的圓形箭頭——跟搭乘車班次結果頁左上角那顆同一個規格（白底圓鈕＋
 *  Font Awesome 的 `arrow-left`，32px 圓、16px 圖示）。
 *
 *  原本是用「←」這個字元排出來的，字元在不同字型下的粗細跟視覺重心都跟搭乘車對不上，
 *  改走 FaIcon 之後兩邊才是同一顆按鈕。實作共用 IconLink（圖示圓鈕的連結版），
 *  這裡只負責固定「返回」這個語意的圖示跟尺寸。
 *
 *  放在 PageHeader 的 actions 裡，取代原本那種佔一整顆按鈕寬度的「‹ 回○○」文字鈕：
 *  標題列按鈕一多就擠，返回是最不需要文字說明的動作，壓成圖示鈕把空間讓給其他操作。
 *  label 不只是無障礙用途，也是 hover 時的提示，所以要寫清楚回到哪裡。 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return <IconLink icon="arrow-left" href={href} label={label} tone="solid" size={32} iconSize={16} />;
}
