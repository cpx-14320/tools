"use client";

import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { colors, gradient, shadow, text, v } from "./theme";
import { FaIcon } from "./fa-icon";

// FreshWise 的通用元件庫（「長相」的部分），搭配 theme.ts 的 token 一起用。價格、漲跌
// 徽章、品項列這些帶有這個工具自己的商業含意的元件不放這裡，各自一個檔案（price-text、
// trend-badge、item-row…），這裡只放「任何頁面都可能用到、換個工具也成立」的那些。
//
// 收進這裡的標準跟搭乘車一樣：同一種樣式在兩個以上的地方出現過。元件只負責長相，不含
// 商業邏輯，按了要做什麼由呼叫端決定。

/* ───────────────────────── 文字 ───────────────────────── */

/** 每一頁最上方的標題列（h1 ＋ 右側可選的操作區）。 */
export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="fw-page-title flex items-start justify-between gap-3">
      <h1 className={text.pageTitle}>{children}</h1>
      {actions}
    </div>
  );
}

/** 頁面內的區塊標題。左邊可帶一個裝飾點，右邊可帶一顆操作鈕或「看全部」。 */
export function SectionTitle({
  children,
  leaf = false,
  action,
  className = "",
}: {
  children: ReactNode;
  /** 左邊加一片葉子裝飾（首頁的幾個區塊標題用，設定頁那種密集清單不用）。 */
  leaf?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`fw-section-title flex items-center gap-1.5 ${text.sectionTitle} ${className}`}>
      {leaf && <FaIcon icon="leaf" size={48} className="text-[#ADC774]" />}
      {children}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
  );
}

/** 欄位小標。 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={text.label}>{children}</span>;
}

/** 備註說明——真的在解釋一件事的句子，字級固定比內文小。 */
export function Note({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`${text.note} ${className}`}>{children}</p>;
}

/** 空狀態／載入中／查無資料。 */
export function Hint({ children, className = "", center = false }: { children: ReactNode; className?: string; center?: boolean }) {
  return <p className={`${text.hint} ${center ? "text-center" : ""} ${className}`}>{children}</p>;
}

export function ErrorText({ children, className = "", center = false }: { children: ReactNode; className?: string; center?: boolean }) {
  return <p className={`${text.error} ${center ? "text-center" : ""} ${className}`}>{children}</p>;
}

/**
 * 一段需要被看見的說明（估算值說明、休市公告、示範資料提示）。
 *
 * 跟 Note 的差別是這個有底色跟圖示——Note 是「順便說一下」，這個是「你必須知道這件事
 * 才不會誤解上面的數字」。整個工具只有三種情況用它，都寫在 theme.ts 的 copy 裡。
 */
/**
 * 提示條：淡底＋插畫小圖示＋一行說明。估算值說明、休市公告、資料來源註記都用這一個。
 *
 * **只有一種配色。** 以前分 `tone="warning" | "neutral"` 兩種，差別只有底色與字色
 * （#FFF0C7/#92611D 與 #F6EEDB/#836A54），同一個元件在不同頁面長得不一樣，使用者看到
 * 的是「兩種看起來很像但又不一樣的提示」。要強調程度不同的時候用文案區分，不要用顏色
 * 再長出一個變體。
 *
 * 底色用 `--fw-paper-sunk`（跟卡片紙、輸入框同一張紙），文字用 warning 的棕金色。
 * 圖示用語意名稱傳（`database`／`calendar-xmark`／`triangle-exclamation`…），
 * fa-icon.tsx 會對應到插畫圖示。
 */
export function Callout({ children, icon = "circle-info" }: { children: ReactNode; icon?: string }) {
  return (
    <div className="fw-callout flex items-start gap-2 rounded-2xl px-3 py-2.5" style={{ backgroundColor: v.paperSunk }}>
      <FaIcon icon={icon} size={12} className="mt-0.5 shrink-0" color={colors.warning} />
      <p className="leading-relaxed" style={{ color: colors.warning, fontSize: v.fsLabel }}>
        {children}
      </p>
    </div>
  );
}

/* ───────────────────────── 按鈕 ───────────────────────── */

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * 主要行動按鈕（實心漸層）。
 * - `block`：整列滿版，用在頁面主要行動。
 * - `inline`：彈窗右下角的「儲存」「確定」。
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
  icon?: string;
  trailingArrow?: boolean;
  className?: string;
} & ButtonBaseProps) {
  const sizeCls = size === "block" ? "flex w-full items-center justify-center gap-2 py-3.5" : "px-5 py-2.5";
  return (
    <button
      type="button"
      className={`fw-primary shrink-0 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${sizeCls} ${className}`}
      style={{ background: gradient.primary, boxShadow: shadow.cta }}
      {...rest}
    >
      {icon && <FaIcon icon={icon} size={14} className="text-white" />}
      {children}
      {trailingArrow && <span aria-hidden>→</span>}
    </button>
  );
}

/** 次要行動（取消）——純文字按鈕。 */
export function GhostButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button type="button" className={`px-4 py-2 text-sm text-[#836A54] transition-colors hover:text-[#6E8C41] ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 破壞性操作（刪除）。 */
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
    <button type="button" className={`font-medium text-[#AE4F4A] ${size === "sm" ? "text-xs" : "text-sm"} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 清單列尾的小膠囊按鈕（看走勢 →、比價 →）。 */
export function PillButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button
      type="button"
      className={`shrink-0 rounded-full bg-[#F6EEDB] px-3 py-1.5 text-xs font-medium text-[#6E8C41] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 文字連結樣式的小按鈕。 */
export function LinkButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button type="button" className={`shrink-0 text-xs font-medium text-[#6E8C41] ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** 虛線框的「＋ 新增…」按鈕。 */
export function AddButton({ children, className = "", ...rest }: { children: ReactNode; className?: string } & ButtonBaseProps) {
  return (
    <button
      type="button"
      className={`fw-add-button w-full rounded-xl border border-dashed border-[#B3A081] py-2.5 text-sm font-medium text-[#6E8C41] ${className}`}
      {...rest}
    >
      ＋ {children}
    </button>
  );
}

/**
 * 圓形圖示按鈕。
 * - `plain`：沒有底色（區塊標題旁的編輯筆）。
 * - `soft`：淡綠底。
 * - `white`：白底（主視覺上面的返回／設定）。
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
      ? "bg-[#F6EEDB]"
      : tone === "white"
        ? "border border-white/50 bg-white/85 shadow-sm backdrop-blur"
        : "";
  return (
    <button
      type="button"
      className={`fw-icon-button grid shrink-0 place-items-center rounded-full text-[#6E8C41] ${toneCls} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <FaIcon icon={icon} size={iconSize} className="text-current" />
    </button>
  );
}

/* ───────────────────── 分頁 / 徽章 ───────────────────── */

/**
 * 分段切換（場所、分類、走勢天數）。
 * `tone="solid"` 是「白底容器＋選中填滿品牌綠」的變體，給場所切換這種最上層的選擇用。
 * `scroll` 讓分頁列可以橫向捲動——分類有五個、場所有三個，再加上「全部」在 430px 寬的
 * 手機上塞不進一行，硬塞的結果是每個分頁的字被壓到換行。
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  tone = "soft",
  ready = true,
  scroll = false,
  className = "",
}: {
  items: readonly { key: T; label: string; icon?: string }[];
  value: T;
  onChange: (key: T) => void;
  tone?: "soft" | "solid";
  /** 讀取使用者偏好前先不要標任何一個為選中，避免閃一下又跳走。 */
  ready?: boolean;
  scroll?: boolean;
  className?: string;
}) {
  const container = tone === "solid" ? "bg-white" : "bg-[#F6EEDB]";
  return (
    <div
      className={`fw-segmented-tabs ${scroll ? "no-scrollbar flex max-w-full overflow-x-auto" : "inline-flex"} items-center gap-1 rounded-full p-1 ${container} ${className}`}
    >
      {items.map((item) => {
        const active = ready && value === item.key;
        const activeCls = tone === "solid" ? "bg-[#6E8C41] text-white" : "bg-white text-[#6E8C41]";
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? activeCls : "text-[#836A54]"
            }`}
            style={active ? { boxShadow: shadow.pill } : undefined}
          >
            {item.icon && <FaIcon icon={item.icon} size={11} className="text-current" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 圓角徽章。配色由呼叫端傳（漲跌、划算、當季各有自己的語意色，見 trend-badge.tsx）。 */
export function Badge({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  /** 顏色是執行期才決定的（語意色查表）時用這個，不要同時傳 className 的配色。 */
  style?: CSSProperties;
}) {
  return (
    <span className={`fw-badge inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 ${text.badge} ${className}`} style={style}>
      {children}
    </span>
  );
}

/* ───────────────────── 輸入 / 選擇 ───────────────────── */

/** 欄位外殼：小標在上、控制項在下，右上角可放一顆輔助操作。 */
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
  /** 控制項本身是 <button>（開彈窗）時用 "div"，不然點擊會被轉送兩次。 */
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

const FIELD_SHELL = "fw-field flex items-center gap-2 rounded-2xl border border-[#D7C3A0] bg-white px-3 py-3 text-left";

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`fw-input rounded-2xl border border-[#D7C3A0] bg-white px-4 py-3 text-sm font-medium text-[#624839] outline-none transition-colors placeholder:text-[#B3A081] focus:border-[#6E8C41] ${className}`}
      {...rest}
    />
  );
}

/** 搜尋框（左邊放放大鏡、有值時右邊出現清除鈕）。行情頁與品項選擇彈窗都用這一個。 */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "搜尋品項",
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 按 Enter 時呼叫。首頁的搜尋框用它跳到行情頁；行情頁本身是邊打邊篩，不需要 Enter。 */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={`${FIELD_SHELL} fw-search-field`}>
      <FaIcon icon="magnifying-glass" size={13} className="text-[#8C7864]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) onSubmit();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#624839] outline-none placeholder:text-[#B3A081]"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="清除" className="shrink-0">
          <FaIcon icon="circle-xmark" size={14} className="text-[#B3A081]" />
        </button>
      )}
    </div>
  );
}

/**
 * 選擇器的外觀——實際展開的是 BottomSheetModal，不是原生 `<select>`。
 *
 * 這個 App 不使用瀏覽器原生的 `<select>` 與 `<input type="date">`：原生展開樣式是系統
 * 內建的，跟整體視覺對不起來。所有「選一個值」的欄位都是 SelectButton ＋ 一個彈窗。
 */
export function SelectButton({
  value,
  placeholder,
  icon,
  chevron = true,
  onClick,
  className = "",
  children,
}: {
  value?: string;
  placeholder?: string;
  /** 左邊的圖示（場所選擇器放 store／cart-shopping 這類）。 */
  icon?: string;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={`${FIELD_SHELL} ${className}`}>
      {icon && <FaIcon icon={icon} size={13} className="text-[#836A54]" />}
      {children ?? <span className={`flex-1 truncate ${value ? text.bodyStrong : text.placeholder}`}>{value || placeholder}</span>}
      {chevron && <FaIcon icon="chevron-down" size={12} className="text-[#B3A081]" />}
    </button>
  );
}

/** 兩欄並排的欄位共用的格線。 */
export function FieldRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-2 ${className}`}>{children}</div>;
}

/** 設定頁的開關。原生 checkbox 的樣式各平台不一樣，自己畫一顆。 */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="fw-switch relative h-6 w-10 shrink-0 rounded-full transition-colors"
      style={{ backgroundColor: checked ? colors.brand : colors.border }}
    >
      <span
        className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}

/* ───────────────────────── 容器 ───────────────────────── */

/** 白底清單卡片。 */
export function ListCard({
  children,
  className = "",
  strong = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** 價格卡用比較深的陰影。 */
  strong?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "style">) {
  return (
    <div className={`fw-paper rounded-2xl bg-white p-3 ${className}`} style={{ boxShadow: strong ? shadow.cardStrong : shadow.card }} {...rest}>
      {children}
    </div>
  );
}

/** 白底、列與列之間有淡分隔線的清單容器。 */
export function DividedCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`fw-notebook flex flex-col divide-y divide-[#E9DFC8] overflow-hidden rounded-2xl bg-white ${className}`}
      style={{ boxShadow: shadow.card }}
    >
      {children}
    </div>
  );
}

/** DividedCard 裡可點的一列（設定頁、市場選擇）。 */
export function DividedRow({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `flex w-full items-center gap-3 px-4 py-3 text-left ${onClick ? "transition-colors hover:bg-[#FCF7EB]" : ""} ${className}`;
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** 有外框、可內部捲動的清單盒（品項選擇、市場清單）。 */
export function ScrollList({ children, className = "", divided = false }: { children: ReactNode; className?: string; divided?: boolean }) {
  return (
    <div className={`flex flex-col overflow-y-auto rounded-2xl border border-[#E9DFC8] ${divided ? "divide-y divide-[#E9DFC8]" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** ScrollList 裡可點的一列。 */
export function ScrollListRow({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#FCF7EB] ${className}`}
    >
      {children}
    </button>
  );
}

/** 清單「沒東西可列」時那一列的文字。 */
export function ListMessage({ children, tone = "hint" }: { children: ReactNode; tone?: "hint" | "error" }) {
  return <p className={`px-4 py-3 text-center ${tone === "error" ? text.error : text.hint}`}>{children}</p>;
}

/** 整頁的空狀態（我的菜籃全空、搜尋沒結果）：圖示＋一句說明＋一顆行動鈕。 */
export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl" style={{ backgroundColor: colors.surfaceSoft }}>
        <FaIcon icon={icon} size={22} className="text-[#8C7864]" />
      </div>
      <p className={text.sectionTitle}>{title}</p>
      {description && <Hint center>{description}</Hint>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** 彈窗裡「一則／一組」的外框。 */
export function EditorItemCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2.5 rounded-2xl border border-[#E9DFC8] p-3 ${className}`}>{children}</div>;
}

/** 彈窗裡每一則的標題列：左邊「第 N 項」、右邊刪除，中間可放拖曳握把。 */
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

/** 拖曳排序的握把。所有可排序的清單都用同一顆，props 由 useDragReorder 的
 *  handleProps(index) 提供。 */
export function DragHandle({ label, ...rest }: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="fw-drag-handle grid size-7 shrink-0 place-items-center rounded-lg text-[#B3A081] transition-colors hover:bg-[#F6EEDB] hover:text-[#6E8C41]"
      {...rest}
    >
      <FaIcon icon="grip-vertical" size={13} className="text-current" />
    </button>
  );
}

export { colors, gradient, shadow, text };
