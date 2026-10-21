"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const tabs = [
  { href: "/tools/expenses", label: "首頁", icon: ICON_PATHS.navHome },
  { href: "/tools/expenses/reports", label: "報表", icon: ICON_PATHS.navReports },
  { href: "/tools/expenses/assets", label: "資產", icon: ICON_PATHS.navAssets },
  { href: "/tools/expenses/pet", label: "養成", icon: ICON_PATHS.navPet },
  { href: "/tools/expenses/more", label: "設定", icon: ICON_PATHS.navSettings },
];

/** 比照搭乘車 TransitMobileNav 的樣式：固定貼齊卡片正下方、滿版橫列、只有上邊框，不是
 *  浮動的膠囊列；圖示 32px、未選取文字用同一個淡紫灰 #B3ABD4，跟搭乘車那份完全一致
 *  （兩邊故意不共用元件，只是刻意對齊視覺規格，色票各自獨立維護）。外殼
 *  （ExpensesMobileShell）的卡片容器本身有 transform，fixed 子孫會以卡片為定位基準，
 *  inset-x-0 直接貼齊卡片左右邊界，理由跟搭乘車那邊一樣。
 *  圖示改走 public/expenses/ 底下的圖檔（見 icon-paths.ts），圖還沒放上去之前 IconImg
 *  會用漸層佔位，不會壞版。 */
export function ExpensesMobileNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-10">
      <nav
        className="flex items-center justify-around border-t border-[#ECE4FA] bg-white px-2 py-2.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {tabs.map((tab) => {
          const active =
            tab.href === "/tools/expenses"
              ? pathname === tab.href
              : tab.href === "/tools/expenses/assets"
                ? ["/tools/expenses/assets", "/tools/expenses/account-types"].some((p) => pathname.startsWith(p))
                : tab.href === "/tools/expenses/more"
                  ? ["/tools/expenses/categories", "/tools/expenses/goals", "/tools/expenses/recurring", "/tools/expenses/budgets", "/tools/expenses/more"].some(
                      (p) => pathname.startsWith(p),
                    )
                  : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
              <IconImg src={tab.icon} alt={tab.label} size={32} background={false} className={active ? "" : "opacity-50"} />
              <span className={active ? "font-semibold text-[#6F5FD6]" : "text-[#B3ABD4]"}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
