"use client";

import { IconImg } from "./icon-img";

/** 底部導覽列的圖示——尺寸跟清單列那組（IconAvatar，見 icon-avatar.tsx）刻意分開：
 *  導覽列是整個 App 的外框，一排五顆、底下還要擺文字，跟著清單的圖一起放大縮小只會
 *  讓底部那條變高。要調導覽列的圖就改這裡一個數字，不會動到任何一頁的內容。
 *
 *  沒選到的分頁整顆淡掉（opacity-50），跟搭乘車底部導覽列同一個規格。 */
const NAV_ICON_SIZE = 32;

export function NavIcon({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return <IconImg src={icon} alt={label} size={NAV_ICON_SIZE} background={false} className={active ? "" : "opacity-50"} />;
}
