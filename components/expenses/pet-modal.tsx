"use client";

import type { ReactNode } from "react";

/** 養成頁專用的彈窗外觀——跟記帳本其他地方那個從底部滑上來的白色 Modal（modal.tsx）
 *  刻意不共用：養成頁是一整張遊戲畫面，彈出一塊方方正正的白色表單會像是跳到另一個 App。
 *  這裡用的是那組插畫 UI 素材（pet-modal-*.png），置中彈出、四周是
 *  畫出來的框。
 *
 *  框是九張切片拼出來的（pet-modal-{top,center,bottom}-{left,center,right}.png），排成
 *  3×3 的格線：
 *    四個角   固定 FRAME px，不縮放（縮放圓角會糊掉）
 *    上下兩邊 寬度拉伸、高度固定
 *    左右兩邊 高度拉伸、寬度固定
 *    正中間   兩邊都拉伸，內容就放在這一格
 *  所以同一組切片可以套在任何大小的彈窗上，不用為每個彈窗各出一張背景圖。 */
const FRAME = 34;

/** 九宮格的其中一張邊／角。bg-[length:100%_100%] 是「拉滿這一格」——角的格子本來就是
 *  固定尺寸，所以不會變形；邊的格子只有單一方向會被拉長，那正是它要的。 */
function Slice({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url("/expenses/pet-modal-${name}.png")`, backgroundSize: "100% 100%" }}
    />
  );
}

export function PetModal({
  open,
  onClose,
  title,
  /** 標題下面那行淡色小字（參考稿的「每天回來，累積小小成長」）。 */
  subtitle,
  children,
  /** 釘在框底的那一塊（簽到那顆大按鈕、商店的購買列）。**不跟著內容捲動**：商店那種
   *  一次列十幾格的彈窗，選好一格之後要按的「確認購買」如果跟著捲走，使用者得先捲到底
   *  才按得到。內容短的時候它就貼在內容下面，看起來跟以前一樣。 */
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 吃 ReactNode 不只吃字串：商店那行要放星星幣圖示＋數字，emoji 的 ⭐ 跟整頁的
   *  插畫對不上（而且在不同平台長得不一樣）。 */
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  // 不 portal 到 document.body（記帳本其他彈窗是那樣做的）：這個彈窗要以**手機卡片**
  // 為範圍置中，不是以整個瀏覽器視窗。外殼那層卡片本身有 transform（見
  // expenses-mobile-shell.tsx），transform 會讓它變成底下所有 fixed 子孫的定位基準，
  // 所以直接畫在原地、用 fixed inset-0，量到的就是卡片的框——底部導覽列也是靠同一招。
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" onClick={onClose}>
      <div className="absolute inset-0 bg-[#2B1B46]/55" />
      {/* pt-7：標題緞帶是騎在框的上緣上的（絕對定位、往上凸一半），這裡先把整塊往下推，
          不然緞帶會被彈窗容器切掉。 */}
      <div className="relative w-full max-w-[360px] pt-7" onClick={(e) => e.stopPropagation()}>
        {/* **高度寫死，不跟著內容長**：養成頁這幾個彈窗的內容長度差很多（活動序號一個
            輸入框、說明三段字、商店十幾格），跟著內容長的話每開一個框都是不同高度、位置
            也跟著上下跳，感覺像好幾個不同的東西。固定之後不管點哪一顆，框都開在同一個
            位置、同一個大小，內容比框長就在中間那一段捲動（框線、標題緞帶、底部按鈕
            都不動）。
            `min(540px, 78dvh)`：540 是裝得下簽到七格的高度；小螢幕（iPhone SE 那種 568px
            高）上 78dvh 比 540 小，這時改用 78dvh，框才不會比可視範圍還高、底下的按鈕
            被切掉。 */}
        <div
          className="grid h-[min(540px,78dvh)]"
          style={{ gridTemplateColumns: `${FRAME}px 1fr ${FRAME}px`, gridTemplateRows: `${FRAME}px minmax(0, 1fr) ${FRAME}px` }}
        >
          <Slice name="top-left" className="col-start-1 row-start-1" />
          <Slice name="top-center" className="col-start-2 row-start-1" />
          <Slice name="top-right" className="col-start-3 row-start-1" />
          <Slice name="center-left" className="col-start-1 row-start-2" />
          <Slice name="center-right" className="col-start-3 row-start-2" />
          <Slice name="bottom-left" className="col-start-1 row-start-3" />
          <Slice name="bottom-center" className="col-start-2 row-start-3" />
          <Slice name="bottom-right" className="col-start-3 row-start-3" />

          {/* 內容放在正中間那一格，底圖就是 center-center 那張切片（整格拉滿）。
              pt-5：留給騎在框上緣的標題緞帶。
              這一格自己再分成「會捲的內容」跟「釘在底下的 footer」兩段，所以底圖只鋪一次、
              捲動的範圍也只有中間那一段。 */}
          <div
            className="col-start-2 row-start-2 flex min-h-0 flex-col px-2 pb-3 pt-5"
            style={{ backgroundImage: 'url("/expenses/pet-modal-center-center.png")', backgroundSize: "100% 100%" }}
          >
            <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {subtitle && <p className="text-center text-xs text-[#9C7FC0]">{subtitle}</p>}
              {children}
            </div>
            {footer && <div className="shrink-0 pt-3">{footer}</div>}
          </div>
        </div>

        {/* 標題緞帶：壓在框的上緣正中間。 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto grid h-[52px] w-[240px] place-items-center bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/expenses/pet-modal_title.png")' }}
        >
          <span className="pb-0.5 text-base font-bold text-[#5B3B8C]">{title}</span>
        </div>

        {/* 關閉鈕：壓在右上角，跟緞帶同一條水平線。 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="absolute right-1 top-1 size-9 bg-contain bg-center bg-no-repeat transition-transform active:scale-90"
          style={{ backgroundImage: 'url("/expenses/pet-close.png")' }}
        />
      </div>
    </div>
  );
}

/** 按鈕高度（px）。 */
const BUTTON_H = 44;

/** 彈窗底部那幾顆按鈕（取消／確認／知道了／立即簽到）。
 *
 *  **純 CSS，不用圖**：這顆的演進是「一整張畫好的膠囊圖」→「三張切片當遮罩、顏色用
 *  CSS 填」→ 現在的「完全不碰圖」。中間那一版其實已經沒有在用圖的長相了（切片只剩
 *  形狀，而那個形狀就是一顆圓角膠囊），卻還是要為了一顆按鈕去載三張 PNG、算遮罩的
 *  位置與尺寸，而且兩層遮罩疊出來的描邊在不同縮放比例下粗細會跳。
 *
 *  改成 border ＋ 漸層之後：描邊就是 border（粗細固定）、底色就是 background-image 的
 *  漸層、圓角就是 rounded-full，寬高怎麼變都不會變形，也少三個圖片請求。顏色仍然照
 *  原本那組插畫色票走（粉紫／淡紫白），所以在遊戲畫面裡看起來還是同一套 UI。
 *
 *  **為什麼還留一層內陰影**：原本的素材上緣有一道亮面，拿掉之後按鈕會變得很平。用
 *  inset 的白色陰影補一道同樣位置的亮邊，不另外多一個元素。 */
export function PetModalButton({
  children,
  onClick,
  tone = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "secondary";
  disabled?: boolean;
}) {
  // 主要動作是粉紫漸層（跟養成頁那組插畫同一個色系），次要是淡紫白底。停用時整顆降彩度，
  // 不是調透明度——透明度會讓底下的插畫背景透出來，看起來像沒畫完。
  const fill = disabled
    ? "linear-gradient(180deg, #E8DEF4, #D8CCEB)"
    : tone === "primary"
      ? "linear-gradient(180deg, #FF9ECB, #ED5C9B)"
      : "linear-gradient(180deg, #FFFFFF, #EFE4FB)";
  const border = disabled ? "#B9A8CF" : tone === "primary" ? "#C9437C" : "#C3AEE4";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid w-full place-items-center rounded-full border-[3px] text-sm font-bold transition-transform ${
        disabled ? "text-[#8E7DAE]" : tone === "primary" ? "text-white" : "text-[#6B4FA8]"
      } ${disabled ? "" : "active:scale-[0.98]"}`}
      style={{
        height: BUTTON_H,
        borderColor: border,
        backgroundImage: fill,
        boxShadow: disabled ? "none" : "inset 0 2px 0 rgba(255,255,255,0.45)",
      }}
    >
      {children}
    </button>
  );
}
