import { isIconPath } from "@/lib/expenses/presets";

/** 記帳本的圖示分成四種情境，各自一個元件、各自決定尺寸，不要互相借用：
 *
 *    清單列   IconAvatar（這個檔案）     40px 色塊＋4px 內距，圖畫在 32px
 *    彈窗挑圖 PickerIcon（這個檔案）     跟著格子寬度縮放的正方形
 *    底部導覽 NavIcon（nav-icon.tsx）    32px，另外一組尺寸
 *    行內小圖 InlineIcon（這個檔案）     接在一行文字旁邊，跟著字級走
 *
 *  養成頁（pet-*.tsx）不在這四種裡：那一頁是一整張遊戲畫面，星星幣、餵食鍵、入口鈕
 *  的大小各自由版面決定，直接用 IconImg 指定尺寸。
 *
 *  以前是「一個 IconImg 到處用，每個呼叫端自己填 size」，結果同一種列表在不同頁面是
 *  36／40／44 三種大小。尺寸收進元件之後，要調整就是改這裡一個數字。 */

/** 清單列的圖示——明細、存錢目標、固定收支、報表分類、分類設定、帳戶類型…凡是「一列
 *  一個項目」的清單都用這個，尺寸固定 40px，呼叫端不能改。
 *
 *  色塊內緣留 4px（p-1）：圖檔自己只留了 6.25% 的透明邊（160px 的圖只有 10px），直接
 *  鋪滿色塊的話圖會貼著邊，看起來像被框框夾住。留白交給版面而不是每張圖的匯出設定，
 *  之後補新圖也不用擔心留白量不一致。
 *
 *  icon 可以是圖片路徑（`/expenses/....png`，預設分類跟圖示選擇器都存這種）或表情符號
 *  （改版前使用者自己建的分類、存錢目標還是用這種）。兩種都吃，呼叫端不用自己判斷——
 *  這也是整個記帳本唯一一個顯示分類圖示的地方，不要再有人直接把 icon 字串當文字輸出
 *  （路徑字串當文字輸出會變成畫面上一串網址）。
 *
 *  圖片一律疊在顏色底上面（不是取代顏色底）：顏色是使用者自己選的分類色，跟圖示是兩個
 *  獨立的設定，換成圖片之後顏色照樣要看得到。圖檔還沒放進 public/expenses 時會是空白，
 *  底色跟方塊仍在，不會破版。 */
export function IconAvatar({
  icon,
  className,
  /** 不要色塊，只畫圖（設定頁那幾排功能入口：圖本身已經是有造型的插畫，再墊一層淡紫
   *  方塊等於把它關進一個跟內容無關的框裡）。尺寸、內距仍然跟有色塊的一樣，所以同一份
   *  清單裡兩種列的文字起點對得齊。 */
  plain = false,
}: {
  icon: string;
  className?: string;
  plain?: boolean;
}) {
  const base = `grid size-10 shrink-0 place-items-center rounded-xl p-1 text-lg ${plain ? "" : (className ?? "bg-[#F3EFFC]")}`;

  if (isIconPath(icon)) {
    return (
      <span className={base}>
        {/* 用 CSS background 而不是 <img>：圖檔還沒上傳時 <img> 會留下破圖圖示，
            background 404 只是沒東西顯示，底色方塊照常。 */}
        <span role="img" aria-hidden className="size-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${icon}")` }} />
      </span>
    );
  }

  return <span className={base}>{icon}</span>;
}

/** 彈窗裡挑圖示用的那一格（新增／編輯分類、批次新增、帳戶類型、存錢目標共用的選擇器）。
 *
 *  跟清單列不同，它的大小是跟著格子走的：選擇器是固定六欄的格狀排列，每一格的寬度取決
 *  於彈窗寬度，所以這裡用 w-full ＋ aspect-square 讓圖跟著欄寬縮放，再用 max-w-10 擋住
 *  在寬螢幕上被放大到比清單裡的圖還大。沒有色塊——挑的是「圖長什麼樣子」，墊一層底色
 *  反而會讓每張圖都被一個方塊框住、看不出差別。 */
export function PickerIcon({ icon, className = "" }: { icon: string; className?: string }) {
  if (!isIconPath(icon)) return <span aria-hidden>{icon}</span>;
  return (
    <span
      role="img"
      aria-hidden
      className={`block aspect-square w-full max-w-10 bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("${icon}")` }}
    />
  );
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
      className={`inline-block shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("${icon}")` }}
    />
  );
}
