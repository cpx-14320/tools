import Link from "next/link";

/** 返回上一層的圓形箭頭——跟搭乘車班次結果頁右上角那顆同一個樣式（白底圓鈕＋左箭頭）。
 *  放在 PageHeader 的 actions 裡，取代原本那種佔一整顆按鈕寬度的「‹ 回○○」文字鈕：
 *  標題列按鈕一多就擠，返回是最不需要文字說明的動作，壓成圖示鈕把空間讓給其他操作。
 *  label 不只是無障礙用途，也是 hover 時的提示，所以要寫清楚回到哪裡。 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-full border border-[#ECE4FA] bg-white text-lg leading-none text-[#6F5FD6]"
    >
      <span aria-hidden>←</span>
    </Link>
  );
}
