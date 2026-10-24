/** Font Awesome 圖示的薄包裝。做法跟搭乘車的 components/transit/fa-icon.tsx 一樣，但兩邊
 *  刻意各留一份（記帳本的元件自成一套，見 expenses-mobile-shell.tsx 開頭的說明）。
 *
 *  字型本身在 app/layout.tsx 全站 import，這裡只負責組 class 跟字級。 */
export function FaIcon({
  icon,
  size = 14,
  className = "text-icon",
}: {
  /** Font Awesome 的圖示名稱（不含 fa- 前綴），例如 "plus"、"magnifying-glass"。 */
  icon: string;
  size?: number;
  /** 預設讀 globals.css 的 --icon 變數；需要不同顏色（例如按鈕裡的白色）才個別傳入覆蓋。 */
  className?: string;
}) {
  return <i aria-hidden="true" className={`fa-solid fa-${icon} ${className}`} style={{ fontSize: size, lineHeight: 1 }} />;
}
