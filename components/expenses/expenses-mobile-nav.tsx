"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

/** `owns` 是「這個頁籤要為哪些路徑亮起來」。
 *
 *  不是每一頁都有自己的頁籤：消費紀錄頁沒有頁籤，但它只會從首頁的「查看全部」／清單
 *  列點進去，所以歸在首頁底下——進去之後底部還是亮著首頁，才知道自己是從哪一區進來的。
 *  收支分類、預算、存錢目標、固定收支同理，都歸在設定底下。 */
const tabs = [
  { href: "/tools/expenses", label: "首頁", icon: ICON_PATHS.navHome, owns: ["/tools/expenses/transactions"] },
  { href: "/tools/expenses/reports", label: "報表", icon: ICON_PATHS.navReports, owns: [] },
  { href: "/tools/expenses/assets", label: "資產", icon: ICON_PATHS.navAssets, owns: ["/tools/expenses/account-types"] },
  { href: "/tools/expenses/pet", label: "養成", icon: ICON_PATHS.navPet, owns: [] },
  {
    href: "/tools/expenses/more",
    label: "設定",
    icon: ICON_PATHS.navSettings,
    owns: ["/tools/expenses/categories", "/tools/expenses/goals", "/tools/expenses/recurring", "/tools/expenses/budgets"],
  },
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
          // 自己的子路由（/more/export、/assets/[id]…）一律算自己；但首頁的 href 是所有
          // 頁面的前綴，不能用 startsWith，要完全相同才算。
          const self = tab.href === "/tools/expenses" ? pathname === tab.href : pathname.startsWith(tab.href);
          const active = self || tab.owns.some((p) => pathname.startsWith(p));
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
