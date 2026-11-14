"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuthStatus } from "@/components/auth-status";

/** 入口頁、登入、註冊、管理後台共用的外殼。
 *
 *  **真的 RWD，不是手動切換**：以前這裡是 LayoutModeProvider ＋ 右上角一顆「電腦版／
 *  手機版」按鈕，選擇存在 localStorage。那個設計有三個問題：切了只影響這幾頁（點進記帳本
 *  又變回手機版，使用者以為按鈕壞了）、電腦版寫死 `w-[1440px]`（筆電 1280 寬就被橫向
 *  捲軸切掉）、而且使用者本來就不該為了看得舒服先去設定一個偏好。改成照螢幕寬度決定：
 *
 *    < lg（手機、平板）  記帳本那種「App 外框」：最寬 430px、置中，sm 以上多一圈白邊
 *                        跟圓角變成手機的樣子，內容自己在框裡捲動。
 *    ≥ lg（桌機）        一般網頁版型：置中的寬容器（最寬 1120px，不是寫死寬度），
 *                        頂部品牌列，內容區由各頁自己決定要幾欄。
 *
 *  兩種版型是**同一份 DOM、靠 responsive class 切換**，不是各畫一份再用 hidden 藏起來
 *  ——表單畫兩份會變成兩組 input（自動填入、id、鍵盤焦點全部都要處理兩次）。 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    // 外層是整個視窗的底色；lg 以下那張卡片自己有漸層（跟記帳本的外殼同一組色），
    // lg 以上不要漸層，整頁就是乾淨的淡紫底。
    <div className="flex min-h-dvh justify-center bg-bg px-0 py-0 sm:px-4 sm:py-6 lg:px-8 lg:py-10">
      <div
        className="flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[linear-gradient(180deg,#EDE6FB_0%,#F3E7F3_45%,#E7DEF9_100%)]
                   sm:min-h-[850px] sm:rounded-[2.25rem] sm:border-[6px] sm:border-white sm:shadow-2xl
                   lg:min-h-0 lg:max-w-[1120px] lg:rounded-none lg:border-0 lg:bg-none lg:shadow-none"
      >
        {/* 手機版：釘在框頂的細列，跟記帳本的頁首同一種高度。
            桌機版：不釘住（整頁本來就捲得動），品牌字放大、跟內容之間留多一點空間。 */}
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-line bg-white/85 px-5 py-3 backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:pb-6 lg:pt-0 lg:backdrop-blur-none">
          <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-ink lg:text-xl">
            🧰 cpx-tools
          </Link>
          <AuthStatus />
        </header>

        {/* 手機版：內容自己捲（外框是固定高度的卡片）。桌機版：交給整頁捲，不要在容器裡
            再開一個捲動區——那會變成頁面跟容器兩條捲軸。 */}
        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0">{children}</main>
      </div>
    </div>
  );
}
