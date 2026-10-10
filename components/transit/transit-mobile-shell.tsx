"use client";

import { Suspense, type ReactNode } from "react";
import { TransitMobileNav } from "./transit-mobile-nav";

/** 這個工具不提供電腦版、沒有切換鈕——但寬螢幕瀏覽時仍然維持「手機外觀」：置中、固定最大
 *  寬度、圓角＋邊框，看起來像個小手機框，不會因為視窗變寬就整頁撐滿。 */
export function TransitMobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center bg-[#EFE9FB] px-0 py-0 sm:px-4 sm:py-6">
      <div
        // h-dvh（不是 h-screen／100vh）是關鍵：手機瀏覽器網址列、Android 系統導覽列
        // 顯示或收起時，視窗可視高度會即時改變，100vh 在部分手機瀏覽器是用「UI 收起
        // 後」的最大高度計算，會讓卡片（連帶 fixed 在卡片底部的導覽列）整體偏低、一
        // 開始被系統 UI 擋住，要等使用者滑動一次讓瀏覽器 UI 收起、高度重新計算後才會
        // 貼齊。100dvh（dynamic viewport height）會隨 UI 顯示狀態即時更新，沒有這個
        // 延遲問題。
        // h-dvh 同時也是「固定、確定」的高度，flex 子項 main 才能正確算出「剩下的可用
        // 空間」當自己的高度，overflow-y-auto 才會真的在 main 內部產生捲動，而不是讓
        // 整個卡片被內容撐得比螢幕還高。之前用 min-h-screen（只設下限）時，內容一多
        // 卡片就被撐到上萬 px 高，main 自己完全沒有內部捲動（跟著整個 document 一起
        // 捲），連帶讓 sticky 失效（sticky 參照的「最近捲動祖先」變成這個永遠
        // scrollTop=0 的卡片本身，不是真的在捲的那層）、go-top 按鈕的點擊命中也跟著
        // 出問題。
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden sm:h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        // transform（哪怕是沒作用的 translateZ(0)）會讓這個卡片容器變成底下所有
        // position:fixed 子孫的定位基準，不再是整個瀏覽器視窗。寬螢幕時卡片本身是
        // 置中、縮小顯示的「手機外觀」，不加這個的話 fixed 子孫（底部導覽列、
        // go-top 按鈕）會貼齊整個瀏覽器視窗邊緣、跟卡片分家飄走，之前得每個 fixed
        // 元素各自用 mx-auto max-w-[430px] 去手動湊；加了這行，底下的 fixed 元素
        // 直接 inset-x-0／right-*／bottom-* 就會精確貼齊卡片邊界，不用再湊。
        style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)", transform: "translateZ(0)" }}
      >
        <main className="min-h-0 flex-1 overflow-y-auto pb-24">{children}</main>

        {/* TransitMobileNav 用 useSearchParams 判斷搜尋結果頁是從哪個分頁點進來的，Next.js
            要求用到 useSearchParams 的元件外面要包 Suspense，不然 build 時會報錯。 */}
        <Suspense fallback={null}>
          <TransitMobileNav />
        </Suspense>
      </div>
    </div>
  );
}
