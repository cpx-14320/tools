/** 通用小圖示一律走 Font Awesome 的圖示字體（已經在 app/layout.tsx 全站引入），不另外
 *  準備 PNG——向量圖示可以直接用 CSS color／font-size 控制顏色與大小，不用每種顏色、
 *  每個尺寸各準備一張圖。
 *
 *  顏色有兩種給法，不要同時給：
 *   - `className`（預設 `text-[#6F947E]`，也就是 theme 的 muted）：顏色寫死在 Tailwind
 *     class 裡的情況，例如 `text-white`、`text-current`（跟著父層的文字顏色走）。
 *   - `color`：顏色是執行期才知道的值（例如依漲跌查 theme 的色票）。
 *
 *  刻意不沿用搭乘車那邊的 `text-icon` 預設值——那是 globals.css 的紫色變數，在這個綠色
 *  工具裡會突兀。
 *
 *  純裝飾用途（旁邊都有看得懂意思的文字標籤），所以 aria-hidden，不讀給螢幕報讀軟體聽。 */
export function FaIcon({
  icon,
  size = 14,
  className = "text-[#6F947E]",
  color,
}: {
  /** Font Awesome 的圖示名稱（不含 fa- 前綴），例如 "carrot"、"store"。 */
  icon: string;
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <i
      aria-hidden="true"
      className={`fa-solid fa-${icon} ${className}`}
      style={{ fontSize: size, lineHeight: 1, color }}
    />
  );
}
