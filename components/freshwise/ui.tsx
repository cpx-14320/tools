"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { colors, gradient, shadow, text, v } from "./theme";
import { FaIcon } from "./fa-icon";
import { SlicedArtwork } from "./game-art";

// FreshWise 的通用元件庫（「長相」的部分），搭配 theme.ts 的 token 一起用。價格、漲跌
// 徽章、品項列這些帶有這個工具自己的商業含意的元件不放這裡，各自一個檔案（price-text、
// trend-badge、item-row…），這裡只放「任何頁面都可能用到、換個工具也成立」的那些。
//
// 收進這裡的標準跟搭乘車一樣：同一種樣式在兩個以上的地方出現過。元件只負責長相，不含
// 商業邏輯，按了要做什麼由呼叫端決定。

/* ───────────────────────── 文字 ───────────────────────── */

/** 每一頁最上方的標題列（h1 ＋ 右側可選的操作區）。 */
export function PageTitle({ children, actions, hanging = false, subtitle }: { children: ReactNode; actions?: ReactNode; hanging?: boolean; subtitle?: ReactNode }) {
  return (
    <div className={`fw-page-title ${hanging ? "fw-page-title-hanging" : ""} flex items-start justify-between gap-3`}>
      <h1 className={text.pageTitle}>{hanging && <SlicedArtwork name="page-hanging-title" format="webp" className="fw-hanging-title-art"/>}{children}</h1>
      {subtitle && <p className="fw-page-subtitle">{subtitle}</p>}
      {actions}
    </div>
  );
}

/** 頁面內的區塊標題。左邊可帶一個裝飾點，右邊可帶一顆操作鈕或「看全部」。 */
export function SectionTitle({
  children,
  leaf = false,
  action,
  onHelp,
  helpLabel,
  className = "",
}: {
  children: ReactNode;
  /** 左邊加一片葉子裝飾（首頁的幾個區塊標題用，設定頁那種密集清單不用）。 */
  leaf?: boolean;
  action?: ReactNode;
  /** 給了就在標題後面加一顆問號，點了由呼叫端開說明。 */
  onHelp?: () => void;
  helpLabel?: string;
  className?: string;
}) {
  return (
    <div className={`fw-section-title flex items-center gap-1 ${text.sectionTitle} ${className}`}>
      {leaf && <FaIcon icon="leaf" size={30} className="text-[#ADC774]" />}
      {children}
      {/* 「這一區是怎麼選出來的」——挑選規則不寫出來，使用者只能猜。 */}
      {onHelp && (
        <button type="button" className="fw-help-dot" onClick={onHelp} aria-label={helpLabel ?? "這一區是怎麼挑的"}>
          ?
        </button>
      )}
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
    <div className="fw-callout">
      <FaIcon icon={icon} size={12} className="mt-0.5 shrink-0" color={colors.warning} />
      <p>{children}</p>
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
      // 顏色、邊框、漸層、立體陰影都在 .fw-primary 裡（插畫皮膚的按鈕長相）。這裡不要
      // 再寫一套白字＋光暈陰影，不然兩邊會打架，CSS 就得用 !important 才蓋得過。
      className={`fw-primary shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60 ${sizeCls} ${className}`}
      {...rest}
    >
      {icon && <FaIcon icon={icon} size={14} />}
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
      className={`fw-add-button w-full border-dashed py-2.5 text-sm font-medium ${className}`}
      {...rest}
    >
      ＋ {children}
    </button>
  );
}

/** 透明底圖示按鈕，供分類編輯與浮動新增操作使用。 */
export function IconButton({
  icon,
  iconSize = 40,
  className = "",
  ...rest
}: {
  icon: string;
  /** 圖示要多大。按鈕的大小由圖示＋內距決定，不要再另外鎖 width/height——以前鎖成
   *  32px、圖示卻是 24px，插畫被塞在一個比它小的框裡，看起來糊糊的。 */
  iconSize?: number;
  className?: string;
} & ButtonBaseProps) {
  return (
    <button type="button" className={`fw-icon-button ${className}`} {...rest}>
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
  ready = true,
  scroll = false,
  className = "",
}: {
  items: readonly { key: T; label: string; icon?: string }[];
  value: T;
  onChange: (key: T) => void;
  /** 讀取使用者偏好前先不要標任何一個為選中，避免閃一下又跳走。 */
  ready?: boolean;
  scroll?: boolean;
  className?: string;
}) {
  // 以前還有個 tone="solid"（白底容器＋選中填滿品牌綠），插畫皮膚上線後 game.css 把兩種
  // tone 都蓋成同一個長相，等於存在兩份只差顏色的設定卻畫出同一個東西。已經移除。
  return (
    <div
      className={`fw-segmented-tabs ${scroll ? "fw-tabs-scroll" : "inline-flex"} ${className}`}
    >
      {items.map((item) => {
        const active = ready && value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className="fw-tab"
          >
            {item.icon && <FaIcon icon={item.icon} size={11} className="text-current" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 排序列（電商常見的那種）。
 *
 * 以前是八個文字分頁（推薦／最划算／跌最多／漲最多／價格低→高／價格高→低／成交量／
 * 依名稱），橫著排一長條、要左右捲才看得完，而且「跌最多」跟「價格低→高」對使用者
 * 來說很難分。改成三個欄位：**推薦 ／ 價格 ／ 漲跌**，有方向性的那兩個重複點就換方向，
 * 箭頭直接畫在欄位上——不用再看文字猜現在是哪一種。
 */
export function SortBar<T extends string>({
  options,
  value,
  onChange,
  onFilter,
  filterOpen = false,
  filterCount = 0,
}: {
  options: readonly { key: T; label: string; asc?: T; desc?: T }[];
  value: T;
  onChange: (key: T) => void;
  /** 篩選併進同一條列的最後一欄——它跟排序是同一件事（決定清單長什麼樣），
   *  分成兩列會多佔一條高度，而且使用者要在兩個地方找。 */
  onFilter?: () => void;
  filterOpen?: boolean;
  filterCount?: number;
}) {
  return (
    <div className="fw-sort-bar" role="group" aria-label="排序方式">
      {options.map((opt) => {
        const isAsc = opt.asc === value;
        const isDesc = opt.desc === value;
        const active = isAsc || isDesc || opt.key === value;
        // 有方向的欄位：按一下先給預設方向，再按一下換方向。
        const next = opt.asc && opt.desc ? (isAsc ? opt.desc : opt.asc) : opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(next)}
            aria-pressed={active}
            className="fw-sort-item"
          >
            {opt.label}
            {opt.asc && opt.desc && (
              <span className="fw-sort-arrows" aria-hidden="true">
                <span data-on={isAsc ? "true" : "false"}>▲</span>
                <span data-on={isDesc ? "true" : "false"}>▼</span>
              </span>
            )}
          </button>
        );
      })}
      {onFilter && (
        <button type="button" onClick={onFilter} aria-expanded={filterOpen} aria-pressed={filterCount > 0} className="fw-sort-item">
          篩選
          {filterCount > 0 && <span className="fw-sort-count">{filterCount}</span>}
        </button>
      )}
    </div>
  );
}

/**
 * 篩選膠囊（只看當季／只看划算…）。以前寫在 browse-view.tsx 裡面，跟 SegmentedTabs
 * 幾乎一樣只是可以多選，現在收進來——兩邊的選中態才不會各長各的。
 */
export function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="fw-filter-pill"
    >
      {label}
      {active ? " ✓" : ""}
    </button>
  );
}

/** 圓角徽章。配色由呼叫端傳（漲跌、划算、當季各有自己的語意色，見 trend-badge.tsx）。 */
export function Badge({
  children,
  size = "md",
  className = "",
  style,
}: {
  children: ReactNode;
  /** `sm` 給首頁「今天值得買」那種小卡用——同一顆徽章只是縮一號，不要為它另寫一個元件。 */
  size?: "md" | "sm";
  className?: string;
  /** 顏色是執行期才決定的（語意色查表）時用這個，不要同時傳 className 的配色。 */
  style?: CSSProperties;
}) {
  return (
    <span className={`fw-badge ${size === "sm" ? "fw-badge-sm" : ""} ${className}`} style={style}>
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

/** 輸入框／選擇器的共同外殼。外觀（邊框、底色、圓角、內陰影）全在這裡，game.css 不再覆蓋。 */
const FIELD_SHELL = "fw-field flex items-center gap-2 text-left";
const FIELD_STYLE: CSSProperties = {
  minHeight: 48,
  border: `1.5px solid ${v.lineField}`,
  borderRadius: 12,
  background: v.paperSunk,
  padding: "8px 12px",
  // 內凹的下緣，讓欄位看起來像壓在紙上的凹槽。
  boxShadow: `inset 0 -2px 0 ${v.sandPale}`,
  color: v.ink,
  fontSize: v.fsLead,
};

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`fw-input font-medium outline-none transition-colors placeholder:text-[#927D64] ${className}`}
      style={FIELD_STYLE}
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
    <div className={`${FIELD_SHELL} fw-search-field`} style={FIELD_STYLE}>
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
    <button type="button" onClick={onClick} className={`${FIELD_SHELL} ${className}`} style={FIELD_STYLE}>
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

/* ───────────────────────── 容器 ───────────────────────── */

/** 白底清單卡片。 */
/**
 * 紙卡片——這個工具的所有「一張紙」都是它。
 *
 * 以前同一張紙寫了四次：`.fw-paper`（ListCard）、`.fw-notebook`（DividedCard）、
 * `.fw-price-list`（行情清單）、再加上設定頁用 `.fw-settings-page .fw-paper` 把前兩個
 * 整組蓋掉——光這四份就用掉 16 個 `!important`，而它們的差別只有內距、圓角、和「要不要
 * 邊框」。現在只有這一個元件，差異用 `variant` 表達。
 *
 * - `plain`：一般卡片（內距 16）
 * - `divided`：清單容器，列與列之間有淡分隔線（內距 2/0）
 * - `list`：行情清單，左上角多一個紙夾裝飾（裝飾本身是 `.fw-price-list:before`，
 *   偽元素只有 CSS 做得到，留在 game.css）
 * - `flush`：設定頁那種「不要框、只用一條虛線分隔」的貼平樣式
 */
export type PaperVariant = "plain" | "divided" | "list" | "flush";

/** 每種紙對應一個 class，樣式在 game.css 的 .fw-paper* 一處——元件不再用 inline style
 *  畫紙（那是上一輪拆 !important 的過渡做法，現在沒有東西會跟它打架了）。 */
const PAPER_CLASS: Record<PaperVariant, string> = {
  plain: "fw-paper",
  divided: "fw-paper fw-notebook fw-stack flex flex-col",
  list: "fw-paper fw-price-list",
  flush: "fw-paper fw-paper-flush",
};

export function Paper({
  children,
  variant = "plain",
  className = "",
  style,
  ...rest
}: {
  children: ReactNode;
  variant?: PaperVariant;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "style">) {
  return (
    <div className={`${PAPER_CLASS[variant]} ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

/** 一般卡片。`strong` 以前是「比較深的陰影」，插畫皮膚統一成同一種紙，留著只是相容。 */
export function ListCard({
  children,
  className = "",
  strong: _strong,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** 以前是「比較深的陰影」，插畫皮膚統一成同一張紙後沒有作用，留著讓呼叫端不用一次全改。 */
  strong?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "style">) {
  void _strong;
  return (
    <Paper className={className} {...rest}>
      {children}
    </Paper>
  );
}

/** 列與列之間有淡分隔線的清單容器。 */
export function DividedCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Paper variant="divided" className={className}>
      {children}
    </Paper>
  );
}

/**
 * 進度條。`<progress>` 裡面放不了文字，所以用 track + fill + 疊在上面的標籤，
 * 語意靠 role="progressbar" 補回來。任務進度與夥伴成長共用同一顆——以前兩邊各寫一份，
 * 一個用 `<progress>`、一個用 div，長得不一樣。
 */
export function MeterBar({
  value,
  max,
  label,
  ariaLabel,
  className = "",
}: {
  value: number;
  max: number;
  /** 疊在條子上的文字，例如 `0／1`。不給就只畫條。 */
  label?: string;
  ariaLabel: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`fw-meter ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={ariaLabel}>
      <span className="fw-meter-fill" style={{ width: `${pct}%` }} />
      {label && <span className="fw-meter-label">{label}</span>}
    </div>
  );
}

/**
 * 超過 `max` 筆就收起來，附一個展開／收合的切換。
 *
 * 首頁的菜籃預覽以前是 `slice(0, 4)` 直接砍掉後面的，使用者菜籃裡有九項卻只看到四項，
 * 會以為資料沒同步。改成「預設顯示前幾筆，其餘收起來但告訴你還有幾筆」。
 */
/** 清單收合的門檻。首頁各區塊與菜籃分類共用同一個數字——同一個 App 裡「幾筆之後要收起來」
 *  只該有一種答案，不然使用者會覺得有的地方收有的地方不收。 */
export const COLLAPSE_AFTER = 5;

export function CollapsibleList({
  children,
  max = COLLAPSE_AFTER,
  moreLabel = (n: number) => `還有 ${n} 項，展開看`,
  lessLabel = "收合",
}: {
  children: ReactNode[];
  max?: number;
  moreLabel?: (hidden: number) => string;
  lessLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = children.length - max;
  const shown = open || hidden <= 0 ? children : children.slice(0, max);
  return (
    <>
      {shown}
      {hidden > 0 && (
        <button type="button" onClick={() => setOpen(!open)} className="fw-collapse-toggle" aria-expanded={open}>
          {open ? lessLabel : moreLabel(hidden)}
        </button>
      )}
    </>
  );
}

/** DividedCard 裡的一列。`onClick` 有傳才會變成可點的按鈕。 */
export function DividedRow({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  // 左右不留內距：帶分隔線的區塊才會跟同一張紙上「只用 gap 疊起來」的區塊對齊在
  // 同一條直線上，兩種版式看起來像同一個東西。
  const cls = `flex w-full items-center gap-3 py-3 text-left ${onClick ? "transition-colors hover:bg-[#FCF7EB]" : ""} ${className}`;
  if (!onClick) return <div className={cls}>{children}</div>;
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

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
      <div className="grid size-14 place-items-center rounded-2xl" style={{ border: `1.5px solid ${v.lineField}`, backgroundColor: v.paperSunk }}>
        <FaIcon icon={icon} size={40} className="text-[#8C7864]" />
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
      className="fw-drag-handle grid size-7 shrink-0 place-items-center rounded-lg transition-colors hover:bg-[#F6EEDB] hover:text-[#6E8C41]"
      {...rest}
    >
      <FaIcon icon="grip-vertical" size={13} className="text-current" />
    </button>
  );
}

export { colors, gradient, shadow, text };
