"use client";

import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { colors, gradient, shadow, text } from "./theme";
import { FaIcon } from "./fa-icon";

// 「搭乘車」工具的共用元件庫，搭配 theme.ts 的 token 一起用。
//
// 收進這裡的判斷標準：同一種樣式在兩個以上的地方出現過。例如「儲存」按鈕的實心漸層
// 樣式原本在 5 個彈窗各寫一次（memo-editor、home-settings、frequent-trip、caption-image、
// trip-group-picker），欄位小標 `text-xs font-medium text-[#9C94C4]` 在十幾個地方各寫
// 一次——這種就該是一個元件，不是複製貼上。
//
// 這些元件只負責「長相」，不含任何商業邏輯，呼叫端照樣自己決定按了要做什麼。

/* ───────────────────────── 文字 ───────────────────────── */

/** 每一頁最上方的標題列（h1 ＋ 右側可選的操作區）。 */
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h1 className={text.pageTitle}>{children}</h1>
      {actions}
    </div>
  );
}

/** 頁面內的區塊標題（備忘錄、分類名稱…）。左邊可帶一個菱形裝飾，右邊可帶一顆操作鈕。 */
export function SectionTitle({
  children,
  diamond = false,
  action,
  className = "",
}: {
  children: ReactNode;
  diamond?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${text.sectionTitle} ${className}`}>
      {diamond && (
        <span aria-hidden className="text-[#C9A6F2]">
          ♦
        </span>
      )}
      {children}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  );
}

/** 欄位小標（縣市、日期、時間、分類名稱…）。 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={text.label}>{children}</span>;
}

/** 備註說明——真的在解釋一件事的句子，字級固定比內文小。 */
export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`${text.note} ${className}`}>{children}</p>;
}

/** 空狀態／載入中／查無資料這類提示文字，全部同一個字級跟淡度。 */
export function Hint({ children, className = "", center = false }: { children: ReactNode; className?: string; center?: boolean }) {
  return <p className={`${text.hint} ${center ? "text-center" : ""} ${className}`}>{children}</p>;
}

export function ErrorText({ children, className = "", center = false }: { children: ReactNode; className?: string; center?: boolean }) {
  return <p className={`${text.error} ${center ? "text-center" : ""} ${className}`}>{children}</p>;
}

/* ───────────────────────── 按鈕 ───────────────────────── */

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * 主要行動按鈕（實心漸層）。兩種尺寸：
 * - `block`：整列滿版，用在「搜尋OO班次」「搜尋附近站牌」這種頁面主要行動。
 * - `inline`：彈窗右下角的「儲存」「確定」「新增並加入」。
 */
export function PrimaryButton({
  children,
  size = "inline",
  icon,
  trailingArrow = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  size?: "block" | "inline";
  /** Font Awesome 圖示名稱（不含 fa- 前綴），放在文字左邊。 */
  icon?: string;
  /** 文字右邊補一個 → 箭頭（「搜尋」這類會換頁的行動才加）。 */
  trailingArrow?: boolean;
  className?: string;
} & ButtonBaseProps) {
  const sizeCls = size === "block" ? "flex w-full items-center justify-center gap-2 py-3.5" : "px-5 py-2.5";
  return (
    <button
      type="button"
      className={`shrink-0 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${sizeCls} ${className}`}
      style={{ background: gradient.primary, boxShadow: shadow.cta }}
      {...rest}
    >
      {icon && <FaIcon icon={icon} size={14} className="text-white" />}
      {children}
      {trailingArrow && <span aria-hidden>→</span>}
    </button>
  );
}

/** 次要行動（取消）——純文字按鈕，不要有底色跟其他按鈕搶視覺。 */
export function GhostButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button type="button" className={`px-4 py-2 text-sm text-[#9C94C4] transition-colors hover:text-[#6F5FD6] ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 破壞性操作（刪除）——紅字文字按鈕。 */
export function DangerButton({
  children,
  size = "sm",
  className = "",
  ...rest
}: {
  children: ReactNode;
  /** sm＝彈窗裡每一則右上角的「刪除」；md＝彈窗底部的「刪除分類」。 */
  size?: "sm" | "md";
  className?: string;
} & ButtonBaseProps) {
  return (
    <button
      type="button"
      className={`font-medium text-[#D1517E] ${size === "sm" ? "text-xs" : "text-sm"} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 清單列尾的小按鈕（搜尋班次 →、立即導航 →）。 */
export function PillButton({
  children,
  className = "",
  as = "button",
  href,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** 真的要連出去（Google Maps 導航）時用 "a"，其他用預設的 "button"。 */
  as?: "button" | "a";
  href?: string;
} & ButtonBaseProps) {
  const cls = `shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6] ${className}`;
  if (as === "a") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/** 文字連結樣式的小按鈕（‹ 重新搜尋、找不到？瀏覽…、切換為手動輸入）。 */
export function LinkButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button type="button" className={`shrink-0 text-xs font-medium text-[#6F5FD6] ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 虛線框的「＋ 新增…」按鈕。 */
export function AddButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button
      type="button"
      className={`w-full rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6] ${className}`}
      {...rest}
    >
      ＋ {children}
    </button>
  );
}

/**
 * 圓形圖示按鈕。三種底色：
 * - `plain`：沒有底色，直接畫在內容上（區塊標題旁的編輯筆）。
 * - `soft`：淡紫底（班次卡片的「＋」）。
 * - `white`：白底（結果頁標題列的返回／加入、主視覺右上角的編輯）。
 */
export function IconButton({
  icon,
  tone = "plain",
  size = 32,
  iconSize = 14,
  className = "",
  ...rest
}: {
  icon: string;
  tone?: "plain" | "soft" | "white";
  size?: number;
  iconSize?: number;
  className?: string;
} & ButtonBaseProps) {
  const toneCls =
    tone === "soft"
      ? "bg-[#F3EFFC] text-[#6F5FD6]"
      : tone === "white"
        ? "border border-[#ECE4FA] bg-white/80 text-[#6F5FD6] shadow-sm backdrop-blur"
        : "text-[#6F5FD6]";
  return (
    <button
      type="button"
      className={`grid shrink-0 place-items-center rounded-full ${toneCls} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <FaIcon icon={icon} size={iconSize} className={tone === "plain" ? "text-icon" : "text-[#6F5FD6]"} />
    </button>
  );
}

/* ───────────────────── 分頁 / 徽章 ───────────────────── */

/**
 * 淡紫底的分段切換（去程／返程、站牌／路線、我的行程的車種分頁）。
 * `tone="solid"` 是結果頁車種篩選那種「白底容器＋選中填滿品牌紫」的變體。
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  tone = "soft",
  /** 讀取使用者偏好（例如上次停留的分頁）前先不要標任何一個為選中，避免閃一下又跳走。 */
  ready = true,
  className = "",
}: {
  items: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  tone?: "soft" | "solid";
  ready?: boolean;
  className?: string;
}) {
  const container = tone === "solid" ? "bg-white" : "bg-[#F3EFFC]";
  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 ${container} ${className}`}>
      {items.map((item) => {
        const active = ready && value === item.key;
        const activeCls =
          tone === "solid" ? "bg-[#6F5FD6] text-white" : "bg-white text-[#6F5FD6]";
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? activeCls : "text-[#9C94C4]"
            }`}
            style={active ? { boxShadow: shadow.pill } : undefined}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 圓角徽章（路線色塊、車次、到站狀態）。配色由呼叫端傳既有的 class 字串進來。 */
export function Badge({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  /** 只給「顏色是執行期才知道的值」用（例如捷運轉乘查到的官方路線色），寫死在 Tailwind
   *  class 裡的配色一律走 className，不要兩種都傳。 */
  style?: CSSProperties;
}) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 ${text.badge} ${className}`} style={style}>
      {children}
    </span>
  );
}

/* ───────────────────── 輸入 / 選擇 ───────────────────── */

/** 欄位外殼：小標在上、控制項在下，右上角可放一顆輔助操作（例如「清除」）。 */
export function Field({
  label,
  action,
  children,
  as = "label",
  className = "",
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  /** 控制項本身是 <button>（開彈窗）時不要用 <label> 包，不然點擊會被轉送兩次。 */
  as?: "label" | "div";
  className?: string;
}) {
  const Tag = as;
  return (
    <Tag className={`flex flex-col gap-1.5 ${className}`}>
      {(label || action) && (
        <span className="flex items-center justify-between gap-2">
          {label ? <FieldLabel>{label}</FieldLabel> : <span />}
          {action}
        </span>
      )}
      {children}
    </Tag>
  );
}

const FIELD_SHELL = "flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left";

/** 文字輸入框。 */
export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none transition-colors placeholder:text-[#C7BFE6] focus:border-[#6F5FD6] ${className}`}
      {...rest}
    />
  );
}

/** 多行文字輸入框（備忘錄內容）。 */
export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`resize-none rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none transition-colors placeholder:text-[#C7BFE6] focus:border-[#6F5FD6] ${className}`}
      {...rest}
    />
  );
}

/**
 * 下拉選單／選擇器的外觀——實際展開的是 BottomSheetModal，不是原生 <select>（原生展開
 * 樣式是系統內建的，跟這個 App 的視覺對不起來）。沒有值時顯示 placeholder 的淡色文字。
 */
export function SelectButton({
  value,
  placeholder,
  chevron = true,
  onClick,
  className = "",
  children,
}: {
  /** 目前選到的值；空字串／undefined 會改顯示 placeholder。 */
  value?: string;
  placeholder?: string;
  /** 預設 true：這顆按鈕本身是點了會跳出選擇畫面的互動元素，箭頭是在告訴使用者「這裡
   *  可以點」。只有兩種情況才該傳 false——(1) 這顆按鈕旁邊緊接著另一顆也會開啟選擇畫面
   *  的按鈕（真正並列的一組，例如編輯彈窗裡「縣市＋站名」兩欄其中一欄只是為了對齊版面
   *  而重複一次同一個箭頭會太擠），這種情況才留一個箭頭；(2) 畫面上同一排的這幾顆按鈕
   *  其實都是同一個欄位的一部分、只有其中一顆才是「真的可以點開」的那顆。
   *  首頁的縣市／站名、公車的縣市／站牌雖然並列，但兩顆都各自能單獨點開選擇畫面（點
   *  縣市只換縣市、點站名只換站名），互動方式一樣，所以兩顆都要留著箭頭，不要套用
   *  「只留最後一個」這條——那樣會讓使用者以為兩顆按鈕的行為不同。 */
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  /** 需要自己排版內容（例如路線色塊＋方向）時直接給 children，不用 value。 */
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={`${FIELD_SHELL} ${className}`}>
      {children ?? (
        <span className={`flex-1 truncate ${value ? text.bodyStrong : text.placeholder}`}>{value || placeholder}</span>
      )}
      {chevron && <FaIcon icon="chevron-down" size={12} className="text-[#C7BFE6]" />}
    </button>
  );
}

/** 兩欄並排的選擇器（縣市＋站名、日期＋時間）共用的格線。 */
export function FieldRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-2 ${className}`}>{children}</div>;
}

/* ───────────────────── 容器 ───────────────────── */

/** 白底清單卡片（備忘錄、常用行程、班次卡）。 */
export function ListCard({
  children,
  className = "",
  strong = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** 班次卡片用比較深的陰影。 */
  strong?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "style">) {
  return (
    <div className={`rounded-2xl bg-white p-3 ${className}`} style={{ boxShadow: strong ? shadow.cardStrong : shadow.card }} {...rest}>
      {children}
    </div>
  );
}

/** 白底、列與列之間有淡分隔線的清單容器（設定頁的幾個清單、Ubike 站點清單）。 */
export function DividedCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white ${className}`} style={{ boxShadow: shadow.card }}>
      {children}
    </div>
  );
}

/** 有外框、可內部捲動的清單盒（搜尋建議、站序、路線清單）。 */
export function ScrollList({ children, className = "", divided = false }: { children: ReactNode; className?: string; divided?: boolean }) {
  return (
    <div
      className={`flex flex-col overflow-y-auto rounded-2xl border border-[#F2EEFA] ${divided ? "divide-y divide-[#F2EEFA]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** ScrollList 裡可點的一列。 */
export function ScrollListRow({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#F8F6FD] ${className}`}
    >
      {children}
    </button>
  );
}

/** ScrollList／DividedCard 裡「沒東西可列」時那一列的文字（載入中、查無資料、錯誤）。 */
export function ListMessage({ children, tone = "hint" }: { children: ReactNode; tone?: "hint" | "error" }) {
  return <p className={`px-4 py-3 text-center ${tone === "error" ? text.error : text.hint}`}>{children}</p>;
}

/** 彈窗裡「一則／一組／一個區塊」的外框。 */
export function EditorItemCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2.5 rounded-2xl border border-[#F2EEFA] p-3 ${className}`}>{children}</div>;
}

/**
 * 彈窗裡每一則的標題列：左邊「第 N 則」、右邊刪除，中間可放拖曳握把。
 * 用詞規則見 theme.ts 的 copy——單位字（則／組／區塊）由呼叫端決定，但句型固定。
 */
export function EditorItemHeader({
  index,
  unit,
  onDelete,
  dragHandle,
}: {
  index: number;
  unit: string;
  onDelete?: () => void;
  dragHandle?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {dragHandle}
      <span className={text.label}>
        第 {index + 1} {unit}
      </span>
      {onDelete && (
        <DangerButton className="ml-auto" onClick={onDelete}>
          刪除
        </DangerButton>
      )}
    </div>
  );
}

/**
 * 拖曳排序的握把。所有可以排序的清單（分類、行程、備忘錄、主視覺／橫幅、天氣區塊）
 * 都用同一顆握把，使用者一看到這個圖示就知道「這裡可以按住拖」。
 * props 由 useDragReorder 的 handleProps(index) 提供。
 */
export function DragHandle({
  label,
  ...rest
}: {
  /** 無障礙用的說明，例如「拖曳排序 上班」。 */
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-7 shrink-0 place-items-center rounded-lg text-[#C7BFE6] transition-colors hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
      {...rest}
    >
      <FaIcon icon="grip-vertical" size={13} className="text-current" />
    </button>
  );
}

/** 顏色 token 也一起 re-export，少數真的需要行內樣式（漸層、陰影）的地方才用。 */
export { colors, gradient, shadow, text };
