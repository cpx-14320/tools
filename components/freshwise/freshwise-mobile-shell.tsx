"use client";

import type { ReactNode } from "react";
import { FreshwiseMobileNav } from "./freshwise-mobile-nav";

/** 這個工具只做手機版、沒有電腦版切換鈕——但寬螢幕瀏覽時仍然維持「手機外觀」：置中、
 *  固定最大寬度、圓角＋白邊，看起來像一台小手機，不會因為視窗變寬就整頁撐滿。
 *  版面公式（430px、h-dvh／sm:h-[850px]）跟搭乘車、記帳本一致，三個工具的手機框是同一
 *  個尺寸。BottomSheetModal 也複製同一組數字（它 portal 到 body、量不到這個容器）。 */
export function FreshwiseMobileShell({ children }: { children: ReactNode }) {
  return (
    // min-h-dvh：這一層是整個視窗的底色。沒有它的話，視窗比卡片高時卡片下方會露出 body
    // 的底色，看起來像背景只鋪到一半。
    <div className="flex min-h-dvh justify-center bg-[#E8F3EC] px-0 py-0 sm:px-4 sm:py-6">
      <div
        // h-dvh（不是 h-screen／100vh）是關鍵：手機瀏覽器的網址列、Android 的系統導覽列
        // 顯示或收起時可視高度會即時改變，100vh 在部分手機瀏覽器是用「UI 收起後」的最大
        // 高度計算，會讓卡片（連帶 fixed 在卡片底部的導覽列）一開始被系統 UI 擋住。
        //
        // h-dvh 同時也是「固定、確定」的高度，flex 子項 main 才算得出「剩下的可用空間」
        // 當自己的高度，overflow-y-auto 才會真的在 main 內部產生捲動，而不是讓整張卡片
        // 被內容撐得比螢幕還高（那會連帶讓 sticky 失效、go-top 按鈕的命中位置出錯）。
        className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden sm:h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl"
        // transform（哪怕是沒作用的 translateZ(0)）會讓這張卡片成為底下所有 position:fixed
        // 子孫的定位基準，不再是整個瀏覽器視窗。少了這行，底部導覽列與回頂部按鈕在寬螢幕
        // 時會貼齊瀏覽器邊緣、跟卡片分家飄走，得每個 fixed 元素各自用 mx-auto max-w 去湊。
        style={{
          background: "linear-gradient(180deg, #EAF5EE 0%, #F2F8EC 45%, #E4F1E9 100%)",
          transform: "translateZ(0)",
        }}
      >
        {/* pb-24 讓內容捲到底時不會被底部導覽列蓋住最後一列。 */}
        <main className="min-h-0 flex-1 overflow-y-auto pb-24">{children}</main>
        <FreshwiseMobileNav />
      </div>
    </div>
  );
}
