import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

/** 入口頁、登入、註冊、管理後台、無權限畫面共用的外殼。
 *
 *  **一種版型，不管螢幕多寬**：以前這裡是「手機＝App 外框、lg 以上＝1120px 的網頁版型」
 *  兩套 responsive 版型。問題是點進記帳本、搭乘車之後又變回 430px 的手機框（兩個工具都
 *  只有手機版版面，見 expenses-mobile-shell.tsx／transit-mobile-shell.tsx），在桌機上
 *  看起來像從一個網站跳到另一個 App。現在這幾頁比照記帳本：不管幾吋都是同一張置中的
 *  App 卡片，寬螢幕就是「桌面上放著一支手機」，整個站從登入到工具內部是同一個東西。
 *
 *  卡片的尺寸／圓角／白邊／陰影／漸層底刻意跟 ExpensesMobileShell 完全一致（h-dvh、
 *  sm:h-[850px]、max-w-[430px]、sm:border-[6px]、同一條三段漸層），所以從登入頁按進
 *  記帳本時外框不會跳動——兩邊各自維護一份樣式字串，但數字要對齊。
 *
 *  header 不在捲動區裡（`shrink-0` 的 flex 子項，main 才是 `overflow-y-auto`），所以
 *  不管內容多長，左上角的返回鍵永遠看得到——管理後台的使用者清單再長也不會變成死路。 */
export function SiteShell({
  children,
  /** 左上角的返回鍵。給了就取代品牌標記，帶使用者回上一層（目前只有管理後台用，
   *  回「工具列表」）。標籤要寫目的地的名字，不要只放一個「‹」——一個箭頭看不出
   *  按下去會到哪裡。 */
  back,
  /** 頁首右邊的小字，用來說明現在在哪一頁（搭配 back 用）。 */
  title,
}: {
  children: ReactNode;
  back?: { href: string; label: string };
  title?: string;
}) {
  return (
    // 這一層是整個視窗的底色；卡片本身是固定高度，視窗更高時下面不要露出 body 的白。
    <div className="flex min-h-dvh justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        // h-dvh（不是 min-h-screen）＋ max-h-dvh：卡片要有確定的高度，裡面的 main 才能
        // 自己捲動，而不是把卡片撐到比螢幕高；筆電（高度 < 850px）時也不會長到畫面外。
        // 理由跟記帳本／搭乘車外殼那兩份註解一樣，這裡比照辦理。
        className="relative flex h-dvh max-h-dvh w-full max-w-[430px] flex-col overflow-hidden sm:h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)", transform: "translateZ(0)" }}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/70 bg-white/70 px-5 py-3 backdrop-blur-sm">
          {back ? (
            <Link
              href={back.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ECE4FA] bg-white px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-surface-2"
            >
              <i aria-hidden className="fa-solid fa-chevron-left text-[10px]" />
              {back.label}
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2.5">
              <BrandMark size={30} />
              <span className="text-base font-bold tracking-tight text-ink">cpx-tools</span>
            </Link>
          )}
          {title && <span className="truncate text-xs font-semibold text-muted">{title}</span>}
        </header>

        {/* min-h-full：內容不夠長時也撐滿捲動區，底下才不會露出外殼的紫色漸層。 */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col px-5 pb-8 pt-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
