"use client";

import type { ReactNode } from "react";

/** 養成頁專用的彈窗外觀——跟記帳本其他地方那個從底部滑上來的白色 Modal（modal.tsx）
 *  刻意不共用：養成頁是一整張遊戲畫面，彈出一塊方方正正的白色表單會像是跳到另一個 App。
 *  這裡用的是那組插畫 UI 素材（pet-modal-*.png／pet-button-*.png），置中彈出、四周是
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
  subtitle?: string;
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
        <div
          className="grid max-h-[78dvh]"
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

/** 按鈕高度（px）。端點切片的寬度跟著它等比算，見下面的 CAP_RATIO。 */
const BUTTON_H = 44;
/** 端點切片原圖是 30×60（寬是高的一半），所以端點寬度＝按鈕高度的一半。 */
const CAP_RATIO = 0.5;

/** 彈窗底部那顆大按鈕。
 *
 *  **形狀用三張切片，顏色用 CSS**：以前整顆是一張畫好的膠囊圖（pet-button-primary.png
 *  ／-secondary.png）直接 `background-size: 100% 100%` 拉到需要的寬度——按鈕只要不是
 *  原圖那個比例，兩頭的圓弧跟亮面就會被拉扁，而且想多一種顏色就得多畫一張圖。
 *
 *  現在改成跟養成頁狀態列同一招（見 pet-view.tsx 的 pillBackground）：左端貼左、右端
 *  貼右、中間那張補滿剩下的寬度，只有中間會被拉伸，所以膠囊兩頭永遠不變形。顏色則是
 *  把那三張切片當**遮罩**（mask）、底下鋪 CSS 漸層，要幾種顏色就幾種，不用再出圖。
 *  遮罩鋪在一層獨立的 span 上而不是按鈕本身——mask 會連子元素一起遮，文字會跟著被切掉。 */
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
  const cap = Math.round(BUTTON_H * CAP_RATIO);
  const slices = ["pet-level-left", "pet-level-right", "pet-level-leftcenter"].map((n) => `url("/expenses/${n}.png")`).join(", ");
  const maskStyle = {
    maskImage: slices,
    WebkitMaskImage: slices,
    maskPosition: `left center, right center, ${cap}px center`,
    WebkitMaskPosition: `left center, right center, ${cap}px center`,
    maskSize: `${cap}px 100%, ${cap}px 100%, calc(100% - ${cap * 2}px) 100%`,
    WebkitMaskSize: `${cap}px 100%, ${cap}px 100%, calc(100% - ${cap * 2}px) 100%`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as const;

  // 主要動作是粉紫漸層（跟養成頁那組插畫同一個色系），次要是淡紫白底。停用時整顆降彩度，
  // 不是調透明度——透明度會讓底下的插畫背景透出來，看起來像沒畫完。
  const fill = disabled
    ? "linear-gradient(180deg, #E8DEF4, #D8CCEB)"
    : tone === "primary"
      ? "linear-gradient(180deg, #FF9ECB, #ED5C9B)"
      : "linear-gradient(180deg, #FFFFFF, #EFE4FB)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative grid w-full place-items-center text-sm font-bold transition-transform ${
        disabled ? "text-[#A694C4]" : tone === "primary" ? "text-white" : "text-[#6B4FA8]"
      } ${disabled ? "" : "active:scale-[0.98]"}`}
      style={{ height: BUTTON_H }}
    >
      <span aria-hidden className="absolute inset-0" style={{ ...maskStyle, backgroundImage: fill }} />
      <span className="relative">{children}</span>
    </button>
  );
}
