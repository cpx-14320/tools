import { isIconPath } from "@/lib/expenses/presets";

/** 分類／目標的圓角圖示方塊——原本 goals-view.tsx（size-11／rounded-2xl／固定淡紫底）
 *  跟 transactions-view.tsx（size-10／rounded-xl／跟著分類顏色變色）各自手刻一份幾乎
 *  一樣的樣式，現在統一成同一個元件：size 決定方塊大小跟圓角，className 沒傳就用預設
 *  的淡紫底（給沒有分類顏色可用的情境，例如存錢目標），傳了就蓋掉背景色（分類列表／
 *  固定收支要用 categoryColorClass 跟著分類變色）。
 *
 *  icon 可以是圖片路徑（`/expenses/....png`，預設分類跟圖示選擇器都存這種）或表情符號
 *  （改版前使用者自己建的分類、存錢目標還是用這種）。兩種都吃，呼叫端不用自己判斷——
 *  這也是整個記帳本唯一一個顯示分類圖示的地方，不要再有人直接把 icon 字串當文字輸出
 *  （路徑字串當文字輸出會變成畫面上一串網址）。
 *
 *  圖片一律疊在顏色底上面（不是取代顏色底）：顏色是使用者自己選的分類色，跟圖示是兩個
 *  獨立的設定，換成圖片之後顏色照樣要看得到。圖檔還沒放進 public/expenses 時會是空白，
 *  底色跟方塊仍在，不會破版。 */
export function IconAvatar({ icon, size = "md", className }: { icon: string; size?: "sm" | "md"; className?: string }) {
  const sizeClass = size === "sm" ? "size-10 rounded-xl text-lg" : "size-11 rounded-2xl text-xl";
  const base = `grid shrink-0 place-items-center ${sizeClass} ${className ?? "bg-[#F3EFFC]"}`;

  if (isIconPath(icon)) {
    return (
      <span className={base}>
        {/* 用 CSS background 而不是 <img>：圖檔還沒上傳時 <img> 會留下破圖圖示，
            background 404 只是沒東西顯示，底色方塊照常。 */}
        <span
          role="img"
          aria-hidden
          className="size-[68%] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${icon}")` }}
        />
      </span>
    );
  }

  return <span className={base}>{icon}</span>;
}

/** 擠在一行文字旁邊的小圖示（膠囊、按鈕標籤、頁首小字那種），沒有底色方塊。
 *
 *  這些地方以前是直接把表情符號接進字串裡（`${icon} ${name}`），換成圖片路徑之後不能
 *  再那樣寫——路徑字串接進文字只會印出一串網址。統一用這個元件，圖片跟表情符號都吃。 */
export function InlineIcon({ icon, className = "size-4" }: { icon: string; className?: string }) {
  if (!isIconPath(icon)) return <span aria-hidden>{icon}</span>;
  return (
    <span
      role="img"
      aria-hidden
      className={`shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("${icon}")` }}
    />
  );
}
