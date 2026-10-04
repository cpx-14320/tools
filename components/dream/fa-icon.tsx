/** 輸入欄位／下拉選單這類通用小圖示改用 Font Awesome 圖示字體，不是客製插畫風格的
 *  PNG（那套留給車種／天氣／備忘錄這些真的有畫插畫的圖示用）。向量圖示可以直接用
 *  CSS color／font-size 控制顏色跟大小，不用像 PNG 圖示那樣每種顏色/尺寸各準備一張圖。
 *  純裝飾用途（旁邊都有看得懂意思的文字標籤），所以預設 aria-hidden，不額外讀給螢幕
 *  報讀軟體聽，跟這個專案裡其他裝飾用的 <span aria-hidden> 箭頭符號同一個邏輯。 */
export function FaIcon({
  icon,
  size = 14,
  className = "text-icon",
}: {
  /** Font Awesome 的圖示名稱（不含 fa- 前綴），例如 "clock"、"location-dot"。 */
  icon: string;
  size?: number;
  /** 預設讀 globals.css 的 --icon 變數（Tailwind 的 text-icon），統一在那裡改顏色就好，
   *  不用每個用到的地方各自改一次；需要不同顏色（例如按鈕裡的白色）才個別傳入覆蓋。 */
  className?: string;
}) {
  return <i aria-hidden="true" className={`fa-solid fa-${icon} ${className}`} style={{ fontSize: size, lineHeight: 1 }} />;
}
