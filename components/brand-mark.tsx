/** cpx-tools 的品牌標記。
 *
 *  **刻意不是表情符號**：原本外殼頂部寫的是「🧰 cpx-tools」，表情符號的長相由作業系統
 *  的字型決定（Windows、iOS、Android 三種畫法），大小、基線、留白都對不準旁邊的文字，
 *  而且跟工具本身的插畫圖示（public/hub/*.png）完全不是同一種畫風——那是整個入口區
 *  看起來最像「隨便拼起來的」地方。
 *
 *  改成自己畫的向量標記：外層是品牌紫漸層的圓角方塊（跟 Button primary、記帳本的
 *  gradient.primary 同一組色），裡面四個白色小塊＝「一包小工具」。純 CSS 漸層 ＋ 無 id
 *  的 inline SVG，所以 server component 也能直接用，不會有 <defs> id 在同一頁出現兩次
 *  的問題（那需要 useId，而 useId 只能在 client component 用）。 */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        // 圓角用比例（28%）而不是固定 px：同一顆標記在頁首是 28px、在登入頁是 56px，
        // 固定 px 的圓角在放大後會看起來像「方塊多了一點點圓」。
        borderRadius: `${Math.round(size * 0.28)}px`,
        background: "linear-gradient(135deg, #8A7CEE, #6F5FD6)",
        boxShadow: "0 8px 20px -8px rgba(111,95,214,0.75)",
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="#fff">
        <rect width="7" height="7" rx="2.2" />
        <rect x="9" width="7" height="7" rx="2.2" opacity=".6" />
        <rect y="9" width="7" height="7" rx="2.2" opacity=".6" />
        <circle cx="12.5" cy="12.5" r="3.5" />
      </svg>
    </span>
  );
}
