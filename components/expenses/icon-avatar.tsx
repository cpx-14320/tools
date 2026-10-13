/** 分類／目標的圓角圖示方塊——原本 goals-view.tsx（size-11／rounded-2xl／固定淡紫底）
 *  跟 transactions-view.tsx（size-10／rounded-xl／跟著分類顏色變色）各自手刻一份幾乎
 *  一樣的樣式，現在統一成同一個元件：size 決定方塊大小跟圓角，className 沒傳就用預設
 *  的淡紫底（給沒有分類顏色可用的情境，例如存錢目標），傳了就蓋掉背景色（分類列表／
 *  固定收支要用 categoryColorClass 跟著分類變色）。 */
export function IconAvatar({ icon, size = "md", className }: { icon: string; size?: "sm" | "md"; className?: string }) {
  const sizeClass = size === "sm" ? "size-10 rounded-xl text-lg" : "size-11 rounded-2xl text-xl";
  return <span className={`grid shrink-0 place-items-center ${sizeClass} ${className ?? "bg-[#F3EFFC]"}`}>{icon}</span>;
}
